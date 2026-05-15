import {
  Controller, Get, Post, Delete, Patch, Param, Body, Req,
  UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';

@Controller('v1/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly db: DatabaseService) {}

  private async canAccessFolder(
    folderId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<boolean> {
    if (isAdmin) return true;
    const fId = new Types.ObjectId(folderId);
    const uId = new Types.ObjectId(userId);

    const folderAccess = await this.db.folderAccess.findOne({ folderId: fId, userId: uId });
    if (folderAccess) return true;

    const accessibleFile = await this.db.file.findOne({
      folderId: fId,
      $or: [
        { ownerId: uId },
        // FileAccess check would require a join or separate query
      ],
    });
    if (accessibleFile) return true;

    // Check FileAccess explicitly
    const fileAccess = await this.db.fileAccess.find({ userId: uId }).populate('fileId');
    const hasFileAccessInFolder = fileAccess.some((fa: any) => fa.fileId?.folderId?.toString() === folderId);
    if (hasFileAccessInFolder) return true;

    try {
      const folder = await this.db.folder.findById(folderId);
      if (!folder) return false;
      const visibleIds = await this.db.getVisibleFolderIds(folder.projectId.toString(), userId);
      return visibleIds.has(folderId);
    } catch {
      return false;
    }
  }

  @Post()
  async createFolder(
    @Body() body: { name: string; projectId: string; parentId?: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create folders' } }, HttpStatus.FORBIDDEN);
    }
    if (!body.name?.trim() || !body.projectId) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'name and projectId are required' } }, HttpStatus.BAD_REQUEST);
    }

    const folder = await this.db.folder.create({
      name: body.name.trim(),
      projectId: new Types.ObjectId(body.projectId),
      parentId: body.parentId ? new Types.ObjectId(body.parentId) : undefined,
    });

    return {
      success: true,
      data: {
        id: folder._id.toString(),
        name: folder.name,
        projectId: folder.projectId.toString(),
        parentId: folder.parentId?.toString() ?? null,
        createdAt: (folder as any).createdAt?.toISOString() ?? new Date().toISOString(),
      },
    };
  }

  @Get('root/:projectId')
  async getRootFolders(@Param('projectId') projectId: string, @Req() req: any) {
    const user = req.user;
    const projId = new Types.ObjectId(projectId);
    const uId = new Types.ObjectId(user.id);

    if (!user.isMasterAdmin) {
      const member = await this.db.projectMember.findOne({ projectId: projId, userId: uId });
      if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);
    }

    const allFolders = await this.db.folder.find({
      projectId: projId,
      $or: [{ parentId: { $exists: false } }, { parentId: null }],
    }).sort({ createdAt: 1 });

    const toDto = (f: any) => ({
      id: f._id.toString(),
      name: f.name,
      projectId: f.projectId.toString(),
      parentId: f.parentId?.toString() ?? null,
      createdAt: f.createdAt?.toISOString() ?? new Date().toISOString(),
    });

    if (user.isMasterAdmin) {
      return { success: true, data: { folders: allFolders.map(toDto) } };
    }

    const visibleIds = await this.db.getVisibleFolderIds(projectId, user.id);
    const folders = allFolders.filter((f) => visibleIds.has(f._id.toString())).map(toDto);

    return { success: true, data: { folders } };
  }

  @Get(':folderId/children')
  async getChildFolders(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    const fId = new Types.ObjectId(folderId);

    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    const allChildren = await this.db.folder.find({ parentId: fId }).sort({ createdAt: 1 });

    const toDto = (f: any) => ({
      id: f._id.toString(),
      name: f.name,
      projectId: f.projectId.toString(),
      parentId: f.parentId?.toString() ?? null,
      createdAt: f.createdAt?.toISOString() ?? new Date().toISOString(),
    });

    if (user.isMasterAdmin) {
      return { success: true, data: { folders: allChildren.map(toDto) } };
    }

    const parent = await this.db.folder.findById(folderId);
    const visibleIds = await this.db.getVisibleFolderIds(parent?.projectId.toString() ?? '', user.id);
    const folders = allChildren.filter((f) => visibleIds.has(f._id.toString())).map(toDto);

    return { success: true, data: { folders } };
  }

  @Get(':folderId/access')
  async getFolderAccess(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    const folder = await this.db.folder.findById(folderId);
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    const accessList = await this.db.folderAccess.find({ folderId: new Types.ObjectId(folderId) }).populate('userId', 'name email');

    return {
      success: true,
      data: {
        folderId,
        folderName: folder.name,
        users: accessList.map((a: any) => ({
          id: a.userId._id.toString(),
          name: a.userId.name,
          email: a.userId.email,
          grantedAt: (a as any).createdAt,
        })),
      },
    };
  }

  @Post(':folderId/access')
  async grantFolderAccess(@Param('folderId') folderId: string, @Body() body: { userId: string }, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    const folder = await this.db.folder.findById(folderId);
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    const targetUser = await this.db.user.findById(body.userId);
    if (!targetUser) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);

    const fId = new Types.ObjectId(folderId);
    const uId = new Types.ObjectId(body.userId);

    // Add to project if needed
    await this.db.projectMember.findOneAndUpdate(
      { projectId: folder.projectId, userId: uId },
      { projectId: folder.projectId, userId: uId },
      { upsert: true, new: true }
    );

    // Grant folder access
    await this.db.folderAccess.findOneAndUpdate(
      { folderId: fId, userId: uId },
      { folderId: fId, userId: uId },
      { upsert: true, new: true }
    );

    await this.db.auditLog.create({
      action: 'FOLDER_ACCESS_GRANTED',
      userId: new Types.ObjectId(user.id),
      projectId: folder.projectId,
      metadata: { folderId, folderName: folder.name, targetUserId: body.userId },
    });

    return { success: true, data: { message: `Access granted to ${targetUser.name}`, user: { id: targetUser._id.toString(), name: targetUser.name, email: targetUser.email } } };
  }

  @Delete(':folderId/access/:userId')
  async revokeFolderAccess(@Param('folderId') folderId: string, @Param('userId') userId: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    await this.db.folderAccess.deleteMany({ folderId: new Types.ObjectId(folderId), userId: new Types.ObjectId(userId) });

    const folder = await this.db.folder.findById(folderId);
    if (folder) {
      await this.db.auditLog.create({
        action: 'FOLDER_ACCESS_REVOKED',
        userId: new Types.ObjectId(user.id),
        projectId: folder.projectId,
        metadata: { folderId, folderName: folder.name, targetUserId: userId },
      });
    }

    return { success: true, data: { message: 'Access revoked' } };
  }

  @Get(':folderId/messages')
  async getMessages(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    const messages = await this.db.message.find({ folderId: new Types.ObjectId(folderId) })
      .populate('senderId', 'name')
      .populate('fileId', 'name mimeType size')
      .sort({ createdAt: 1 });

    return {
      success: true,
      data: {
        messages: messages.map((m: any) => ({
          id: m._id.toString(),
          folderId: m.folderId.toString(),
          senderId: m.senderId._id.toString(),
          senderName: m.senderId?.name ?? 'Unknown',
          messageType: m.messageType,
          text: m.text ?? null,
          attachment: m.fileId
            ? { fileId: m.fileId._id.toString(), fileName: m.fileId.name, mimeType: m.fileId.mimeType, size: m.fileId.size }
            : null,
          createdAt: (m as any).createdAt.toISOString(),
        })),
      },
    };
  }

  @Post(':folderId/messages')
  async sendMessage(@Param('folderId') folderId: string, @Body() body: { messageType?: string; text?: string; fileId?: string }, @Req() req: any) {
    const user = req.user;
    const hasAccess = await this.canAccessFolder(folderId, user.id, user.isMasterAdmin);
    if (!hasAccess) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    const messageType = body.messageType ?? 'text';
    const message = await this.db.message.create({
      folderId: new Types.ObjectId(folderId),
      senderId: new Types.ObjectId(user.id),
      messageType,
      text: messageType === 'text' ? body.text?.trim() : undefined,
      fileId: messageType === 'file' ? new Types.ObjectId(body.fileId) : undefined,
    });

    const populated = await message.populate([
      { path: 'senderId', select: 'name' },
      { path: 'fileId', select: 'name mimeType size' }
    ]);

    return {
      success: true,
      data: {
        message: {
          id: populated._id.toString(),
          folderId: populated.folderId.toString(),
          senderId: populated.senderId._id.toString(),
          senderName: (populated.senderId as any).name ?? 'Unknown',
          messageType: populated.messageType,
          text: populated.text ?? null,
          attachment: (populated.fileId as any)
            ? { fileId: (populated.fileId as any)._id.toString(), fileName: (populated.fileId as any).name, mimeType: (populated.fileId as any).mimeType, size: (populated.fileId as any).size }
            : null,
          createdAt: (populated as any).createdAt.toISOString(),
        },
      },
    };
  }

  @Patch(':folderId')
  async renameFolder(@Param('folderId') folderId: string, @Body() body: { name: string }, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    const folder = await this.db.folder.findByIdAndUpdate(
      folderId,
      { name: body.name.trim() },
      { new: true }
    );
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    return { success: true, data: { id: folder._id.toString(), name: folder.name } };
  }

  @Delete(':folderId')
  async deleteFolder(@Param('folderId') folderId: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    const folder = await this.db.folder.findById(folderId);
    if (!folder) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Folder not found' } }, HttpStatus.NOT_FOUND);

    // Collect all descendant folder IDs via BFS, then cascade-delete everything.
    const allFolderIds: Types.ObjectId[] = [];
    const queue: Types.ObjectId[] = [folder._id as Types.ObjectId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      allFolderIds.push(current);
      const children = await this.db.folder.find({ parentId: current }, '_id');
      for (const child of children) {
        queue.push(child._id as Types.ObjectId);
      }
    }

    // Delete all related data for every folder in the subtree.
    await Promise.all([
      this.db.folderAccess.deleteMany({ folderId: { $in: allFolderIds } }),
      this.db.message.deleteMany({ folderId: { $in: allFolderIds } }),
      this.db.file.deleteMany({ folderId: { $in: allFolderIds } }),
      this.db.folder.deleteMany({ _id: { $in: allFolderIds } }),
    ]);

    return { success: true, data: { message: 'Folder and all nested subfolders deleted' } };
  }
}
