import {
  Controller, Get, Post, Delete, Patch, Param, Body, Req,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Permission helpers ───────────────────────────────────────────────────────

  /**
   * Unified folder access check.
   * A regular user can access a folder if ANY of these is true:
   *   1. They have an explicit FolderAccess row for this folder (folder-level sharing)
   *   2. They own at least one file in this folder
   *   3. They have FileAccess to at least one file in this folder
   * Admin always has access.
   */
  private async canAccessFolder(
    folderId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<boolean> {
    if (isAdmin) return true;

    // Check 1: explicit folder-level access
    const folderAccess = await this.prisma.folderAccess.findUnique({
      where: { folderId_userId: { folderId, userId } },
    }).catch(() => null);
    if (folderAccess) return true;

    // Check 2 & 3: file-level access (owned or explicitly shared)
    const accessibleFile = await this.prisma.file.findFirst({
      where: {
        folderId,
        OR: [
          { ownerId: userId },
          { sharedWith: { some: { userId } } },
        ],
      },
    });
    if (accessibleFile) return true;

    // Deep check: Is any ancestor explicitly shared?
    try {
      const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) return false;
      const accessibleIds = await this.getAccessibleFolderIds(folder.projectId, userId);
      return accessibleIds.has(folderId);
    } catch {
      return false;
    }
  }

  /**
   * Returns the set of folderIds a user can see within a project.
   * Used for filtering folder lists without N+1 queries.
   * Combines folder-level access + file-level access.
   */
  private async getAccessibleFolderIds(
    projectId: string,
    userId: string,
  ): Promise<Set<string>> {
    // Folder-level access rows
    const folderAccessRows = await this.prisma.folderAccess.findMany({
      where: { userId },
      select: { folderId: true },
    }).catch(() => []);

    // File-level access (owned or shared files)
    const accessibleFiles = await this.prisma.file.findMany({
      where: {
        projectId,
        OR: [
          { ownerId: userId },
          { sharedWith: { some: { userId } } },
        ],
      },
      select: { folderId: true },
    });

    const ids = new Set<string>();
    const explicitIds = new Set<string>();

    for (const row of folderAccessRows) {
      ids.add(row.folderId);
      explicitIds.add(row.folderId);
    }
    
    const implicitIds = new Set<string>();
    for (const f of accessibleFiles) {
      if (f.folderId) {
        ids.add(f.folderId);
        implicitIds.add(f.folderId);
      }
    }

    try {
      const allFolders = await this.prisma.folder.findMany({
        where: { projectId },
        select: { id: true, parentId: true },
      });
      
      const folderTree = new Map<string, string[]>();
      const parentMap = new Map<string, string>();
      
      for (const f of allFolders) {
        if (f.parentId) {
          if (!folderTree.has(f.parentId)) folderTree.set(f.parentId, []);
          folderTree.get(f.parentId)!.push(f.id);
          parentMap.set(f.id, f.parentId);
        }
      }
      
      const queue = Array.from(explicitIds);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const children = folderTree.get(curr) || [];
        for (const child of children) {
          if (!ids.has(child)) {
            ids.add(child);
            queue.push(child);
          }
        }
      }
      
      for (const impId of implicitIds) {
        let curr = parentMap.get(impId);
        while (curr && !ids.has(curr)) {
          ids.add(curr);
          curr = parentMap.get(curr);
        }
      }
    } catch (err) {
      console.error('Failed to resolve folder tree', err);
    }

    return ids;
  }

  // ─── POST /v1/folders — create folder ────────────────────────────────────────

  @Post()
  async createFolder(
    @Body() body: { name: string; projectId: string; parentId?: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create folders' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.name?.trim() || !body.projectId) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'name and projectId are required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: body.name.trim(),
        projectId: body.projectId,
        parentId: body.parentId || null,
      },
    });

    return { success: true, data: folder };
  }

  // ─── GET /v1/folders/root/:projectId ─────────────────────────────────────────

  @Get('root/:projectId')
  async getRootFolders(@Param('projectId') projectId: string, @Req() req: any) {
    const user = req.user;

    const member = user.isMasterAdmin
      ? true
      : await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: user.id } },
        });
    if (!member) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No access' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const allFolders = await this.prisma.folder.findMany({
      where: { projectId, parentId: null },
      orderBy: { createdAt: 'asc' },
    });

    if (user.isMasterAdmin) {
      return { success: true, data: { folders: allFolders } };
    }

    // Regular user: filter to only folders they can access
    const accessibleIds = await this.getAccessibleFolderIds(projectId, user.id);
    const folders = allFolders.filter((f) => accessibleIds.has(f.id));

    return { success: true, data: { folders } };
  }

  // ─── GET /v1/folders/:folderId/children ──────────────────────────────────────

  @Get(':folderId/children')
  async getChildFolders(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;

    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No access to this folder' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const allChildren = await this.prisma.folder.findMany({
      where: { parentId: folderId },
      orderBy: { createdAt: 'asc' },
    });

    if (user.isMasterAdmin) {
      return { success: true, data: { folders: allChildren } };
    }

    // Get the projectId from the parent folder
    const parent = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { projectId: true },
    });

    const accessibleIds = await this.getAccessibleFolderIds(
      parent?.projectId ?? '',
      user.id,
    );
    const folders = allChildren.filter((f) => accessibleIds.has(f.id));

    return { success: true, data: { folders } };
  }

  // ─── GET /v1/folders/:folderId/access — list users with folder access ─────────

  @Get(':folderId/access')
  async getFolderAccess(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can view folder access' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    const accessList = await this.prisma.folderAccess.findMany({
      where: { folderId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return {
      success: true,
      data: {
        folderId,
        folderName: folder.name,
        users: accessList.map((a) => ({
          ...a.user,
          grantedAt: a.grantedAt,
        })),
      },
    };
  }

  // ─── POST /v1/folders/:folderId/access — grant folder access ─────────────────

  @Post(':folderId/access')
  async grantFolderAccess(
    @Param('folderId') folderId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can grant folder access' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.userId) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'userId is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    // Auto-add user to project if not already a member
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: folder.projectId, userId: body.userId } },
      update: {},
      create: { projectId: folder.projectId, userId: body.userId } as any,
    });

    // Grant folder access — upsert to avoid duplicates
    await this.prisma.folderAccess.upsert({
      where: { folderId_userId: { folderId, userId: body.userId } },
      update: {},
      create: { folderId, userId: body.userId },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'FOLDER_ACCESS_GRANTED',
        userId: user.id,
        projectId: folder.projectId,
        metadata: { folderId, folderName: folder.name, targetUserId: body.userId },
      },
    });

    return {
      success: true,
      data: { message: `Folder access granted to ${targetUser.name}`, user: targetUser },
    };
  }

  // ─── DELETE /v1/folders/:folderId/access/:userId — revoke folder access ──────

  @Delete(':folderId/access/:userId')
  async revokeFolderAccess(
    @Param('folderId') folderId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can revoke folder access' } },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.folderAccess.deleteMany({ where: { folderId, userId } });

    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (folder) {
      await this.prisma.auditLog.create({
        data: {
          action: 'FOLDER_ACCESS_REVOKED',
          userId: user.id,
          projectId: folder.projectId,
          metadata: { folderId, folderName: folder.name, targetUserId: userId },
        },
      });
    }

    return { success: true, data: { message: 'Folder access revoked' } };
  }

  // ─── GET /v1/folders/:folderId/messages ──────────────────────────────────────

  @Get(':folderId/messages')
  async getMessages(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;

    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No access to this folder chat' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const messages = await this.prisma.message.findMany({
      where: { folderId },
      include: {
        sender: { select: { id: true, name: true } },
        file: { select: { id: true, name: true, mimeType: true, size: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          folderId: m.folderId,
          senderId: m.senderId,
          senderName: m.sender?.name ?? 'Unknown',
          messageType: m.messageType,
          text: m.text ?? null,
          attachment: m.file
            ? { fileId: m.file.id, fileName: m.file.name, mimeType: m.file.mimeType, size: m.file.size }
            : null,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    };
  }

  // ─── POST /v1/folders/:folderId/messages ─────────────────────────────────────

  @Post(':folderId/messages')
  async sendMessage(
    @Param('folderId') folderId: string,
    @Body() body: { messageType?: string; text?: string; fileId?: string },
    @Req() req: any,
  ) {
    const user = req.user;

    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No access to this folder chat' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const messageType = body.messageType ?? 'text';
    if (messageType === 'text' && !body.text?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'text is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (messageType === 'file' && !body.fileId) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'fileId is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const message = await this.prisma.message.create({
      data: {
        folderId,
        senderId: user.id,
        messageType,
        text: messageType === 'text' ? body.text!.trim() : null,
        fileId: messageType === 'file' ? body.fileId : null,
      },
      include: {
        sender: { select: { id: true, name: true } },
        file: { select: { id: true, name: true, mimeType: true, size: true } },
      },
    });

    return {
      success: true,
      data: {
        message: {
          id: message.id,
          folderId: message.folderId,
          senderId: message.senderId,
          senderName: message.sender?.name ?? 'Unknown',
          messageType: message.messageType,
          text: message.text ?? null,
          attachment: message.file
            ? { fileId: message.file.id, fileName: message.file.name, mimeType: message.file.mimeType, size: message.file.size }
            : null,
          createdAt: message.createdAt.toISOString(),
        },
      },
    };
  }
  // ─── PATCH /v1/folders/:folderId — rename folder ─────────────────────────────

  @Patch(':folderId')
  async renameFolder(
    @Param('folderId') folderId: string,
    @Body() body: { name: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can rename folders' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.name?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Folder name is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { name: body.name.trim() },
    });
    return { success: true, data: updated };
  }

  // ─── DELETE /v1/folders/:folderId — delete folder ────────────────────────────

  @Delete(':folderId')
  async deleteFolder(
    @Param('folderId') folderId: string,
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can delete folders' } },
        HttpStatus.FORBIDDEN,
      );
    }
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);
    }
    
    // Note: Due to cascade delete, this will remove child folders and file records.
    // The physical files on disk for those file records will be orphaned.
    // For a robust system, physical deletion should be queued or handled, but Prisma DB constraint handles the data layer.
    await this.prisma.folder.delete({ where: { id: folderId } });
    return { success: true, data: { message: 'Folder deleted successfully' } };
  }
}
