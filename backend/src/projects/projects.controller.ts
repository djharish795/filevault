import { Controller, Get, Post, Patch, Delete, Req, UseGuards, Param, HttpException, HttpStatus, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async createProject(
    @Body() body: { name: string; caseNumber: string },
    @Req() req: any,
  ) {
    const user = req.user;

    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create projects' } },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!body.name?.trim() || !body.caseNumber?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Project name and case number are required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const project = await this.prisma.project.create({
      data: {
        name: body.name.trim(),
        caseNumber: body.caseNumber.trim(),
        members: {
          create: [{ userId: user.id } as any],
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'PROJECT_CREATED',
        userId: user.id,
        projectId: project.id,
        metadata: { name: project.name, caseNumber: project.caseNumber },
      },
    });

    return {
      success: true,
      data: {
        id: project.id,
        name: project.name,
        caseNumber: project.caseNumber,
        memberCount: 1,
        updatedAt: project.updatedAt,
      },
    };
  }

  @Get()
  async getProjects(@Req() req) {
    const user = req.user;
    
    let projects;
    if (user.isMasterAdmin) {
      projects = await this.prisma.project.findMany({
        include: { _count: { select: { members: true } } },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      const pm = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
        include: { project: { include: { _count: { select: { members: true } } } } },
        orderBy: { project: { updatedAt: 'desc' } }
      });
      projects = pm.map(m => m.project);
    }

    return {
      success: true,
      data: projects.map(p => ({
        id: p.id,
        name: p.name,
        caseNumber: p.caseNumber,
        memberCount: p._count?.members || 0,
        updatedAt: p.updatedAt
      }))
    };
  }

  @Get(':id')
  async getProjectDetails(@Param('id') id: string, @Req() req) {
    const user = req.user;

    // Fetch all project members to know who is admin
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        files: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    // Access check: admin sees all, members see their project
    if (!user.isMasterAdmin) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: user.id } },
      });
      if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access to project' } }, HttpStatus.FORBIDDEN);
    }

    // All permissions are equal — if you're a member, you have full access
    const permissions = { can_view: true, can_upload: true, can_delete: true, can_share: true };

    // ─── File visibility (strict per-file access) ─────────────────────────────
    // Admin          → sees ALL files
    // Regular user   → sees ONLY:
    //   1. Files they uploaded (ownerId === user.id)
    //   2. Files explicitly shared with them via FileAccess table
    let visibleFiles;

    if (user.isMasterAdmin) {
      visibleFiles = project.files;
    } else {
      // Filter in-memory using the files already fetched with the project.
      // For each file: show it if user is the owner.
      // For shared files: check FileAccess table separately.
      // Using try/catch because FileAccess table may not exist yet if db push hasn't run.
      let sharedFileIds = new Set<string>();
      try {
        const entries = await (this.prisma as any).fileAccess.findMany({
          where: { userId: user.id },
          select: { fileId: true },
        });
        sharedFileIds = new Set(entries.map((e: any) => e.fileId));
      } catch (err) {
        // FileAccess table not yet created — run: npx prisma db push
        console.error('[FileAccess] Query failed:', err?.message ?? err);
      }

      visibleFiles = project.files.filter(file =>
        file.ownerId === user.id ||
        sharedFileIds.has(file.id)
      );
    }

    const mappedFiles = visibleFiles.map(file => ({
      id: file.id,
      name: file.name,
      type: file.mimeType,
      size: file.size,
      folderId: file.folderId ?? null,
      updatedAt: file.updatedAt.toISOString().split('T')[0],
      owner: file.owner.name,
      permissions: {
        canView: true,
        canDownload: true,
        canDelete: user.isMasterAdmin || file.ownerId === user.id,
        canShare: user.isMasterAdmin || file.ownerId === user.id,
      },
    }));

    return {
      success: true,
      data: {
        id: project.id,
        name: project.name,
        caseNumber: project.caseNumber,
        permissions,
        files: mappedFiles,
      },
    };
  }

  @Patch(':id')
  async updateProject(
    @Param('id') id: string,
    @Body() body: { name?: string; caseNumber?: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can edit projects' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.caseNumber && { caseNumber: body.caseNumber.trim() }),
      },
      include: { _count: { select: { members: true } } },
    });

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        caseNumber: updated.caseNumber,
        memberCount: updated._count.members,
        updatedAt: updated.updatedAt,
      },
    };
  }

  // ─── Create subfolder inside a project ───────────────────────────────────────

  @Post(':id/folders')
  async createFolder(
    @Param('id') projectId: string,
    @Body() body: { name: string },
    @Req() req: any,
  ) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create folders' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!body.name?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Folder name is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    const folder = await (this.prisma as any).folder.create({
      data: { name: body.name.trim(), projectId },
    });

    return { success: true, data: { id: folder.id, name: folder.name, projectId: folder.projectId } };
  }

  // ─── Get subfolders of a project ──────────────────────────────────────────────

  @Get(':id/folders')
  async getFolders(@Param('id') projectId: string, @Req() req: any) {
    const user = req.user;

    const member = user.isMasterAdmin ? true : await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    let folders: any[] = [];
    try {
      folders = await (this.prisma as any).folder.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      // Folder table not yet created — run: npx prisma db push
    }

    return { success: true, data: { folders } };
  }

  @Delete(':id')
  async deleteProject(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can delete projects' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    // Cascade delete handled by Prisma schema (members, files, auditLogs)
    await this.prisma.project.delete({ where: { id } });

    return { success: true, data: { message: 'Project deleted successfully' } };
  }
}
