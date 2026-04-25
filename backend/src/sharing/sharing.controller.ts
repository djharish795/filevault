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
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/projects/:projectId/sharing')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── GET: Who has access to this project ─────────────────────────────────────

  @Get()
  async getPeopleWithAccess(@Param('projectId') projectId: string, @Req() req: any) {
    const user = req.user;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    const isMember = project.members.some(m => m.userId === user.id);
    if (!user.isMasterAdmin && !isMember) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    const people = project.members.map(m => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      isOwner: m.user.id === user.id && user.isMasterAdmin,
    }));

    return { success: true, data: { people } };
  }

  // ─── POST: Add a user to the project ─────────────────────────────────────────

  @Post()
  async addUserToProject(
    @Param('projectId') projectId: string,
    @Body() body: { email: string },
    @Req() req: any,
  ) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can share access' } }, HttpStatus.FORBIDDEN);
    if (!body.email) throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Email is required' } }, HttpStatus.BAD_REQUEST);

    const targetUser = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!targetUser) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: `No user found with email "${body.email}"` } }, HttpStatus.NOT_FOUND);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUser.id } },
      update: {},
      create: { projectId, userId: targetUser.id } as any,
    });

    await this.prisma.auditLog.create({
      data: { action: 'ACCESS_GRANTED', userId: requestingUser.id, projectId, metadata: { targetUserId: targetUser.id, targetEmail: targetUser.email } },
    });

    return { success: true, data: { userId: targetUser.id, name: targetUser.name, email: targetUser.email, message: `Access granted to ${targetUser.name}` } };
  }

  // ─── DELETE: Remove a user's project access ───────────────────────────────────

  @Delete(':userId')
  async removeUserAccess(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can remove access' } }, HttpStatus.FORBIDDEN);

    const existing = await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!existing) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User is not a member of this project' } }, HttpStatus.NOT_FOUND);

    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });

    await this.prisma.auditLog.create({
      data: { action: 'ACCESS_REVOKED', userId: requestingUser.id, projectId, metadata: { targetUserId: userId } },
    });

    return { success: true, data: { message: 'Access removed successfully' } };
  }

  // ─── GET: Search users not yet in project ─────────────────────────────────────

  @Get('search-users')
  async searchUsers(@Param('projectId') projectId: string, @Req() req: any) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can search users' } }, HttpStatus.FORBIDDEN);

    const members = await this.prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } });
    const memberIds = members.map(m => m.userId);

    const users = await this.prisma.user.findMany({
      where: { id: { notIn: memberIds } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: { users } };
  }

  // ─── GET: Who has access to a specific file ──────────────────────────────────

  @Get('files/:fileId/access')
  async getFileAccess(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can view file access' } }, HttpStatus.FORBIDDEN);

    const file = await this.prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    let sharedWith: any[] = [];
    try {
      const entries = await (this.prisma as any).fileAccess.findMany({
        where: { fileId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      sharedWith = entries.map((e: any) => e.user);
    } catch {
      // FileAccess table not yet created — run: npx prisma db push
    }

    return {
      success: true,
      data: {
        fileId,
        fileName: file.name,
        sharedWith,
      },
    };
  }

  // ─── POST: Share a specific file with a user ──────────────────────────────────

  @Post('files/:fileId/share')
  async shareFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    const requestingUser = req.user;

    const file = await this.prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canShare = requestingUser.isMasterAdmin || file.ownerId === requestingUser.id;
    if (!canShare) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin or file owner can share files' } }, HttpStatus.FORBIDDEN);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: body.userId } },
    });
    if (!member) throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'User must be a project member first' } }, HttpStatus.BAD_REQUEST);

    await (this.prisma as any).fileAccess.upsert({
      where: { fileId_userId: { fileId, userId: body.userId } },
      update: {},
      create: { fileId, userId: body.userId },
    }).catch((err: any) => {
      console.error('[FileAccess] Insert failed:', err?.message ?? err);
      throw new HttpException(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save file access. Run: npx prisma db push' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    await this.prisma.auditLog.create({
      data: { action: 'FILE_SHARED', userId: requestingUser.id, projectId, fileId, metadata: { targetUserId: body.userId } },
    });

    return { success: true, data: { message: 'File shared successfully' } };
  }

  // ─── DELETE: Revoke file access ───────────────────────────────────────────────

  @Delete('files/:fileId/share/:userId')
  async revokeFileAccess(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const requestingUser = req.user;
    if (!requestingUser.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can revoke file access' } }, HttpStatus.FORBIDDEN);

    await (this.prisma as any).fileAccess.deleteMany({ where: { fileId, userId } });

    await this.prisma.auditLog.create({
      data: { action: 'FILE_ACCESS_REVOKED', userId: requestingUser.id, projectId, fileId, metadata: { targetUserId: userId } },
    });

    return { success: true, data: { message: 'File access revoked' } };
  }
}
