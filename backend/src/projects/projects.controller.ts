import { Controller, Get, Post, Patch, Delete, Req, UseGuards, Param, HttpException, HttpStatus, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private db: DatabaseService) {}

  @Post()
  async createProject(
    @Body() body: { name: string; caseNumber?: string },
    @Req() req: any,
  ) {
    const user = req.user;

    if (!user.isMasterAdmin) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create projects' } },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!body.name?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Project name is required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Create the project
    const project: any = await this.db.project.create({
      name: body.name.trim(),
      caseNumber: body.caseNumber?.trim() || undefined,
    });

    // 2. Add the creator as a member
    await this.db.projectMember.create({
      projectId: project._id,
      userId: new Types.ObjectId(user.id),
    });

    // 3. Create audit log
    await this.db.auditLog.create({
      action: 'PROJECT_CREATED',
      userId: new Types.ObjectId(user.id),
      projectId: project._id,
      metadata: { name: project.name, caseNumber: project.caseNumber },
    });

    return {
      success: true,
      data: {
        id: project._id.toString(),
        name: project.name,
        caseNumber: project.caseNumber,
        memberCount: 1,
        updatedAt: (project as any).updatedAt,
      },
    };
  }

  @Get()
  async getProjects(@Req() req) {
    const user = req.user;
    const uId = new Types.ObjectId(user.id);
    
    let projects;
    if (user.isMasterAdmin) {
      projects = await this.db.project.find().sort({ updatedAt: -1 });
    } else {
      const pm = await this.db.projectMember.find({ userId: uId }).populate('projectId');
      projects = pm.map((m: any) => m.projectId).filter(p => !!p);
    }

    // Get member counts
    const projectData = await Promise.all(projects.map(async (p) => {
      const count = await this.db.projectMember.countDocuments({ projectId: p._id });
      return {
        id: p._id.toString(),
        name: p.name,
        caseNumber: p.caseNumber,
        memberCount: count,
        updatedAt: (p as any).updatedAt,
      };
    }));

    return {
      success: true,
      data: projectData,
    };
  }

  @Get(':id')
  async getProjectDetails(@Param('id') id: string, @Req() req) {
    const user = req.user;
    const projId = new Types.ObjectId(id);

    const project = await this.db.project.findById(id);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    // Access check
    if (!user.isMasterAdmin) {
      const member = await this.db.projectMember.findOne({ projectId: projId, userId: new Types.ObjectId(user.id) });
      if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access to project' } }, HttpStatus.FORBIDDEN);
    }

    const permissions = { can_view: true, can_upload: true, can_delete: true, can_share: true };

    // File visibility using centralized getAccessibleFileIds
    let mappedFiles;
    if (user.isMasterAdmin) {
      const visibleFiles = await this.db.file.find({ projectId: projId }).populate('ownerId', 'name email').sort({ createdAt: -1 });
      mappedFiles = visibleFiles.map((file: any) => ({
        id: file._id.toString(),
        name: file.name,
        type: file.mimeType,
        size: file.size,
        folderId: file.folderId?.toString() ?? null,
        updatedAt: file.updatedAt.toISOString().split('T')[0],
        owner: file.ownerId?.name ?? 'Unknown',
        permissions: {
          canView: true,
          canDownload: true,
          canDelete: true,
          canShare: true,
        },
      }));
    } else {
      const accessibleFileIds = await this.db.getAccessibleFileIds(id, user.id, user.isMasterAdmin);
      const visibleFiles = await this.db.file.find({
        projectId: projId,
        _id: { $in: Array.from(accessibleFileIds).map(id => new Types.ObjectId(id)) },
      }).populate('ownerId', 'name email').sort({ createdAt: -1 });

      mappedFiles = visibleFiles.map((file: any) => ({
        id: file._id.toString(),
        name: file.name,
        type: file.mimeType,
        size: file.size,
        folderId: file.folderId?.toString() ?? null,
        updatedAt: file.updatedAt.toISOString().split('T')[0],
        owner: file.ownerId?.name ?? 'Unknown',
        permissions: {
          canView: true,
          canDownload: true,
          canDelete: file.ownerId?._id.toString() === user.id,
          canShare: file.ownerId?._id.toString() === user.id,
        },
      }));
    }

    return {
      success: true,
      data: {
        id: project._id.toString(),
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

    const project = await this.db.project.findById(id);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    if (body.name) project.name = body.name.trim();
    if (body.caseNumber !== undefined) project.caseNumber = body.caseNumber?.trim() || undefined;
    
    await project.save();
    const memberCount = await this.db.projectMember.countDocuments({ projectId: project._id });

    return {
      success: true,
      data: {
        id: project._id.toString(),
        name: project.name,
        caseNumber: project.caseNumber,
        memberCount,
        updatedAt: (project as any).updatedAt,
      },
    };
  }

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

    const project = await this.db.project.findById(projectId);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    const folder = await this.db.folder.create({
      name: body.name.trim(),
      projectId: project._id,
    });

    return {
      success: true,
      data: {
        id: folder._id.toString(),
        name: folder.name,
        projectId: folder.projectId.toString(),
      },
    };
  }

  @Get(':id/folders')
  async getFolders(@Param('id') projectId: string, @Req() req: any) {
    const user = req.user;
    const projId = new Types.ObjectId(projectId);

    // Access check
    if (!user.isMasterAdmin) {
      const member = await this.db.projectMember.findOne({ projectId: projId, userId: new Types.ObjectId(user.id) });
      if (!member) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);
    }

    const allFolders = await this.db.folder.find({ projectId: projId }).sort({ createdAt: 1 });

    if (user.isMasterAdmin) {
      return {
        success: true,
        data: { folders: allFolders.map(f => ({ id: f._id.toString(), name: f.name, projectId: f.projectId.toString() })) },
      };
    }

    const visibleIds = await this.db.getAccessibleFolderIds(projectId, user.id, user.isMasterAdmin);
    const folders = allFolders
      .filter(f => visibleIds.has(f._id.toString()))
      .map(f => ({ id: f._id.toString(), name: f.name, projectId: f.projectId.toString() }));

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

    const project = await this.db.project.findById(id);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    // Manual cascade delete (Mongoose doesn't do this automatically like Prisma)
    const projId = project._id;
    await Promise.all([
      this.db.projectMember.deleteMany({ projectId: projId }),
      this.db.file.deleteMany({ projectId: projId }),
      this.db.folder.deleteMany({ projectId: projId }),
      this.db.auditLog.deleteMany({ projectId: projId }),
      this.db.project.deleteOne({ _id: projId }),
    ]);

    return { success: true, data: { message: 'Project deleted successfully' } };
  }
}
