import { Controller, Get, Post, Param, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly prisma: PrismaService) {}

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
        { success: false, error: { code: 'INTERNAL_ERROR', message: err.message ?? 'Failed to create folder. Run: npx prisma db push' } },
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
      const folders = await (this.prisma as any).folder.findMany({
        where: { projectId, parentId: null },
        orderBy: { createdAt: 'asc' },
      });
      return { success: true, data: { folders } };
    } catch {
      return { success: true, data: { folders: [] } };
    }
  }

  // ─── GET /v1/folders/:folderId/children — get direct children of a folder ────

  @Get(':folderId/children')
  async getChildFolders(@Param('folderId') folderId: string, @Req() req: any) {
    try {
      const folders = await (this.prisma as any).folder.findMany({
        where: { parentId: folderId },
        orderBy: { createdAt: 'asc' },
      });
      return { success: true, data: { folders } };
    } catch {
      return { success: true, data: { folders: [] } };
    }
  }
}
