import {
  Controller, Get, Post, Delete, Param, Body, Req,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** Returns true if the user can access the given folder.
   *  Admin always can. Regular user needs at least one file in that folder they own or have been shared. */
  private async canAccessFolder(folderId: string, userId: string, isAdmin: boolean): Promise<boolean> {
    if (isAdmin) return true;
    
    // Check if user has any files in this folder (owned or shared)
    const accessibleFile = await this.prisma.file.findFirst({
      where: {
        folderId,
        OR: [
          { ownerId: userId },
          { sharedWith: { some: { userId } } },
        ],
      },
    });
    
    return accessibleFile !== null;
  }

  // ─── POST /v1/folders — create folder (root or nested) ───────────────────────

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

    try {
      const folder = await (this.prisma as any).folder.create({
        data: {
          name: body.name.trim(),
          projectId: body.projectId,
          parentId: body.parentId || null,
        },
      });

      return { success: true, data: folder };
    } catch (err: any) {
      throw new HttpException(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err.message ?? 'Failed to create folder.' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── GET /v1/folders/root/:projectId — get root folders of a project ─────────

  @Get('root/:projectId')
  async getRootFolders(@Param('projectId') projectId: string, @Req() req: any) {
    const user = req.user;

    const member = user.isMasterAdmin ? true : await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    try {
      let folders = await (this.prisma as any).folder.findMany({
        where: { projectId, parentId: null },
        orderBy: { createdAt: 'asc' },
      });

      // FILE-LEVEL ACCESS MODEL:
      // Regular users only see folders that contain files they have access to
      if (!user.isMasterAdmin) {
        // Get all files the user has access to (owned or shared)
        const accessibleFiles = await this.prisma.file.findMany({
          where: {
            projectId,
            OR: [
              { ownerId: user.id },
              { sharedWith: { some: { userId: user.id } } },
            ],
          },
          select: { folderId: true },
        });

        // Extract unique folder IDs from accessible files
        const accessibleFolderIds = new Set(
          accessibleFiles
            .map(f => f.folderId)
            .filter((id): id is string => id !== null)
        );

        // Only show folders that contain accessible files
        folders = folders.filter((f: any) => accessibleFolderIds.has(f.id));
      }

      return { success: true, data: { folders } };
    } catch {
      return { success: true, data: { folders: [] } };
    }
  }

  // ─── GET /v1/folders/:folderId/children — get direct children of a folder ────

  @Get(':folderId/children')
  async getChildFolders(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;

    // Check access to parent folder first (user must have files in parent)
    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access to this folder' } }, HttpStatus.FORBIDDEN);
    }

    try {
      let folders = await (this.prisma as any).folder.findMany({
        where: { parentId: folderId },
        orderBy: { createdAt: 'asc' },
      });

      // FILE-LEVEL ACCESS MODEL:
      // Regular users only see subfolders that contain files they have access to
      if (!user.isMasterAdmin) {
        // Get all files the user has access to in these subfolders
        const childFolderIds = folders.map((f: any) => f.id);
        const accessibleFiles = await this.prisma.file.findMany({
          where: {
            folderId: { in: childFolderIds },
            OR: [
              { ownerId: user.id },
              { sharedWith: { some: { userId: user.id } } },
            ],
          },
          select: { folderId: true },
        });

        const accessibleFolderIds = new Set(
          accessibleFiles
            .map(f => f.folderId)
            .filter((id): id is string => id !== null)
        );

        folders = folders.filter((f: any) => accessibleFolderIds.has(f.id));
      }

      return { success: true, data: { folders } };
    } catch {
      return { success: true, data: { folders: [] } };
    }
  }

  // ─── GET /v1/folders/:folderId/access — who has access to this folder ────────

  @Get(':folderId/access')
  async getFolderAccess(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can view folder access' } }, HttpStatus.FORBIDDEN);
    }

    const folder = await (this.prisma as any).folder.findUnique({ where: { id: folderId } }).catch(() => null);
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    const accessList = await (this.prisma as any).folderAccess.findMany({
      where: { folderId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }).catch(() => []);

    return {
      success: true,
      data: {
        folderId,
        folderName: folder.name,
        users: accessList.map((a: any) => a.user),
      },
    };
  }

  // ─── POST /v1/folders/:folderId/access — grant a user access to a folder ─────

  @Post(':folderId/access')
  async grantFolderAccess(
    @Param('folderId') folderId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can grant folder access' } }, HttpStatus.FORBIDDEN);
    }
    if (!body.userId) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'userId is required' } }, HttpStatus.BAD_REQUEST);
    }

    const folder = await (this.prisma as any).folder.findUnique({ where: { id: folderId } }).catch(() => null);
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    // Target user must be a project member
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: folder.projectId, userId: body.userId } },
    });
    if (!member) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'User must be a project member first' } }, HttpStatus.BAD_REQUEST);
    }

    await (this.prisma as any).folderAccess.upsert({
      where: { folderId_userId: { folderId, userId: body.userId } },
      update: {},
      create: { folderId, userId: body.userId },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'FOLDER_ACCESS_GRANTED',
        userId: user.id,
        projectId: folder.projectId,
        metadata: { folderId, targetUserId: body.userId },
      },
    });

    const targetUser = await this.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true, email: true },
    });

    return { success: true, data: { message: `Access granted to ${targetUser?.name}`, user: targetUser } };
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
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can revoke folder access' } }, HttpStatus.FORBIDDEN);
    }

    await (this.prisma as any).folderAccess.deleteMany({ where: { folderId, userId } });

    const folder = await (this.prisma as any).folder.findUnique({ where: { id: folderId } }).catch(() => null);
    if (folder) {
      await this.prisma.auditLog.create({
        data: {
          action: 'FOLDER_ACCESS_REVOKED',
          userId: user.id,
          projectId: folder.projectId,
          metadata: { folderId, targetUserId: userId },
        },
      });
    }

    return { success: true, data: { message: 'Folder access revoked' } };
  }

  // ─── GET /v1/folders/:folderId/messages — get chat messages for a folder ─────
  // Chat access is based on file sharing: if user has access to files in folder, they can chat

  @Get(':folderId/messages')
  async getMessages(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;

    // Check if user has access to any files in this folder (file-based access)
    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException({ 
        success: false, 
        error: { 
          code: 'FORBIDDEN', 
          message: 'No access to this folder. You need files shared with you to access chat.' 
        } 
      }, HttpStatus.FORBIDDEN);
    }

    const messages = await (this.prisma as any).message.findMany({
      where: { folderId },
      include: {
        sender: { select: { id: true, name: true } },
        file: { select: { id: true, name: true, mimeType: true, size: true } },
      },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);

    const mapped = messages.map((m: any) => ({
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
    }));

    return { success: true, data: { messages: mapped } };
  }

  // ─── POST /v1/folders/:folderId/messages — send a chat message ───────────────
  // Chat access is based on file sharing: if user has access to files in folder, they can chat

  @Post(':folderId/messages')
  async sendMessage(
    @Param('folderId') folderId: string,
    @Body() body: { messageType?: string; text?: string; fileId?: string },
    @Req() req: any,
  ) {
    const user = req.user;

    // Check if user has access to any files in this folder (file-based access)
    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) {
      throw new HttpException({ 
        success: false, 
        error: { 
          code: 'FORBIDDEN', 
          message: 'No access to this folder. You need files shared with you to send messages.' 
        } 
      }, HttpStatus.FORBIDDEN);
    }

    const messageType = body.messageType ?? 'text';

    if (messageType === 'text' && !body.text?.trim()) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'text is required for text messages' } }, HttpStatus.BAD_REQUEST);
    }
    if (messageType === 'file' && !body.fileId) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'fileId is required for file messages' } }, HttpStatus.BAD_REQUEST);
    }

    const message = await (this.prisma as any).message.create({
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

    const mapped = {
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
    };

    return { success: true, data: { message: mapped } };
  }
}
