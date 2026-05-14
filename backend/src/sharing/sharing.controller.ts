import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';

@Controller('v1/projects/:projectId/sharing')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async getPeopleWithAccess(@Param('projectId') projectId: string, @Req() req: any) {
    const user = req.user;
    const projId = new Types.ObjectId(projectId);

    const project = await this.db.project.findById(projectId);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    const members = await this.db.projectMember.find({ projectId: projId }).populate('userId', 'name email');
    const isMember = members.some(m => m.userId?._id.toString() === user.id);
    
    if (!user.isMasterAdmin && !isMember) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    const people = members.map((m: any) => ({
      userId: m.userId._id.toString(),
      name: m.userId.name,
      email: m.userId.email,
      isOwner: m.userId._id.toString() === user.id && user.isMasterAdmin,
    }));

    return { success: true, data: { people } };
  }

  @Post()
  async addUserToProject(@Param('projectId') projectId: string, @Body() body: { email: string }, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can share access' } }, HttpStatus.FORBIDDEN);
    if (!body.email) throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Email is required' } }, HttpStatus.BAD_REQUEST);

    const targetUser = await this.db.user.findOne({ email: body.email });
    if (!targetUser) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: `No user found with email "${body.email}"` } }, HttpStatus.NOT_FOUND);

    const projId = new Types.ObjectId(projectId);
    const uId = targetUser._id;

    await this.db.projectMember.findOneAndUpdate(
      { projectId: projId, userId: uId },
      { projectId: projId, userId: uId },
      { upsert: true, new: true }
    );

    await this.db.auditLog.create({
      action: 'ACCESS_GRANTED',
      userId: new Types.ObjectId(requestingUser.id),
      projectId: projId,
      metadata: { targetUserId: uId.toString(), targetEmail: targetUser.email },
    });

    return { success: true, data: { userId: uId.toString(), name: targetUser.name, email: targetUser.email, message: `Access granted to ${targetUser.name}` } };
  }

  @Delete(':userId')
  async removeUserAccess(@Param('projectId') projectId: string, @Param('userId') userId: string, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can remove access' } }, HttpStatus.FORBIDDEN);

    const projId = new Types.ObjectId(projectId);
    const uId = new Types.ObjectId(userId);

    const existing = await this.db.projectMember.findOne({ projectId: projId, userId: uId });
    if (!existing) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User is not a member' } }, HttpStatus.NOT_FOUND);

    await this.db.projectMember.deleteOne({ projectId: projId, userId: uId });

    await this.db.auditLog.create({
      action: 'ACCESS_REVOKED',
      userId: new Types.ObjectId(requestingUser.id),
      projectId: projId,
      metadata: { targetUserId: userId },
    });

    return { success: true, data: { message: 'Access removed successfully' } };
  }

  @Get('search-users')
  async searchUsers(@Param('projectId') projectId: string, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can search' } }, HttpStatus.FORBIDDEN);

    const projId = new Types.ObjectId(projectId);
    const members = await this.db.projectMember.find({ projectId: projId }).select('userId');
    const memberIds = members.map(m => m.userId);

    const users = await this.db.user.find({
      _id: { $nin: memberIds },
    }).select('name email').sort({ name: 1 });

    return { success: true, data: { users: users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email })) } };
  }

  @Get('files/:fileId/access')
  async getFileAccess(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can view' } }, HttpStatus.FORBIDDEN);

    const fId = new Types.ObjectId(fileId);
    const projId = new Types.ObjectId(projectId);

    const file = await this.db.file.findOne({ _id: fId, projectId: projId });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const accessList = await this.db.fileAccess.find({ fileId: fId }).populate('userId', 'name email');

    return {
      success: true,
      data: {
        fileId,
        fileName: file.name,
        sharedWith: accessList.map((e: any) => ({
          id: e.userId._id.toString(),
          name: e.userId.name,
          email: e.userId.email,
        })),
      },
    };
  }

  @Post('files/:fileId/share')
  async shareFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Body() body: { userId: string }, @Req() req: any) {
    const requestingUser = req.user;
    const fId = new Types.ObjectId(fileId);
    const uId = new Types.ObjectId(body.userId);
    const projId = new Types.ObjectId(projectId);

    const file = await this.db.file.findOne({ _id: fId, projectId: projId });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canShare = requestingUser.isMasterAdmin || file.ownerId.toString() === requestingUser.id;
    if (!canShare) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No permission' } }, HttpStatus.FORBIDDEN);

    // Auto-add to project
    await this.db.projectMember.findOneAndUpdate(
      { projectId: projId, userId: uId },
      { projectId: projId, userId: uId },
      { upsert: true, new: true }
    );

    // Grant file access
    await this.db.fileAccess.findOneAndUpdate(
      { fileId: fId, userId: uId },
      { fileId: fId, userId: uId },
      { upsert: true, new: true }
    );

    await this.db.auditLog.create({
      action: 'FILE_SHARED',
      userId: new Types.ObjectId(requestingUser.id),
      projectId: projId,
      fileId: fId,
      metadata: { targetUserId: body.userId },
    });

    return { success: true, data: { message: 'File shared successfully' } };
  }

  @Delete('files/:fileId/share/:userId')
  async revokeFileAccess(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Param('userId') userId: string, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);

    const fId = new Types.ObjectId(fileId);
    const uId = new Types.ObjectId(userId);
    const projId = new Types.ObjectId(projectId);

    await this.db.fileAccess.deleteMany({ fileId: fId, userId: uId });

    await this.db.auditLog.create({
      action: 'FILE_ACCESS_REVOKED',
      userId: new Types.ObjectId(requestingUser.id),
      projectId: projId,
      fileId: fId,
      metadata: { targetUserId: userId },
    });

    return { success: true, data: { message: 'File access revoked' } };
  }
}
