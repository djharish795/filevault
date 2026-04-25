import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('v1/projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Upload ──────────────────────────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Use the upload dir from StorageService (resolved at startup)
          cb(null, join(process.cwd(), 'uploads'));
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const ext = extname(file.originalname);
          const safe = file.originalname
            .replace(ext, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 40);
          cb(null, `${timestamp}-${random}-${safe}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB hard limit
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain',
          'text/csv',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new HttpException(
            { success: false, error: { code: 'INVALID_FILE_TYPE', message: `File type "${file.mimetype}" is not allowed` } },
            HttpStatus.BAD_REQUEST,
          ), false);
        }
      },
    }),
  )
  async uploadFile(
    @Param('projectId') projectId: string,
    @UploadedFile() file: { fieldname: string; originalname: string; encoding: string; mimetype: string; size: number; destination: string; filename: string; path: string; buffer: Buffer },
    @Req() req: any,
  ) {
    const user = req.user;

    // Guard: file must be present
    if (!file) {
      throw new HttpException(
        { success: false, error: { code: 'NO_FILE', message: 'No file selected' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Guard: project must exist
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      this.storageService.deleteFile(file.filename);
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    // Guard: upload permission
    const canUpload = await this.checkUploadPermission(projectId, user);
    if (!canUpload) {
      this.storageService.deleteFile(file.filename);
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have upload permission for this project' } },
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const filePath = this.storageService.getFileUrl(file.filename);

      // Save metadata to database
      const saved = await this.prisma.file.create({
        data: {
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storageKey: file.filename,
          projectId,
          ownerId: user.id,
          folderId: (req.body?.folderId as string) || null,
        },
        include: { owner: { select: { name: true, email: true } } },
      });

      // If admin uploaded the file, auto-share with all project members
      if (user.isMasterAdmin) {
        try {
          const members = await this.prisma.projectMember.findMany({
            where: { projectId, userId: { not: user.id } },
            select: { userId: true },
          });
          if (members.length > 0) {
            await this.prisma.fileAccess.createMany({
              data: members.map(m => ({ fileId: saved.id, userId: m.userId })),
              skipDuplicates: true,
            });
          }
        } catch {
          // FileAccess table may not exist yet — run: npx prisma db push
          // Upload still succeeds without auto-sharing
        }
      }

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'FILE_UPLOADED',
          userId: user.id,
          projectId,
          fileId: saved.id,
          metadata: { fileName: file.originalname, fileSize: file.size, filePath },
        },
      });

      return {
        success: true,
        data: {
          id: saved.id,
          name: saved.name,
          type: saved.mimeType,
          size: saved.size,
          filePath,
          updatedAt: saved.updatedAt.toISOString().split('T')[0],
          owner: saved.owner.name,
          permissions: {
            canView: true,
            canDownload: true,
            canDelete: true,
            canShare: true,
          },
        },
      };
    } catch (error) {
      // Clean up disk file if DB write fails
      this.storageService.deleteFile(file.filename);
      throw new HttpException(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save file' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Download ─────────────────────────────────────────────────────────────────

  @Get(':fileId/download')
  async downloadFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const user = req.user;

    const file = await this.prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'File not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    const canView = await this.checkViewPermission(projectId, user);
    if (!canView) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No access to this file' } },
        HttpStatus.FORBIDDEN,
      );
    }

    const diskPath = join(process.cwd(), 'uploads', file.storageKey);
    const fs = await import('fs');
    if (!fs.existsSync(diskPath)) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'File not found on disk' } },
        HttpStatus.NOT_FOUND,
      );
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'FILE_ACCESSED',
        userId: user.id,
        projectId,
        fileId: file.id,
        metadata: { fileName: file.name, accessType: 'download' },
      },
    });

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.sendFile(diskPath);
  }

  // ─── Rename ───────────────────────────────────────────────────────────────────

  @Patch(':fileId')
  async renameFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Body() body: { name: string },
    @Req() req: any,
  ) {
    const user = req.user;

    const file = await this.prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canRename = user.isMasterAdmin || file.ownerId === user.id;
    if (!canRename) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No rename permission' } }, HttpStatus.FORBIDDEN);

    if (!body.name?.trim()) throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Name is required' } }, HttpStatus.BAD_REQUEST);

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { name: body.name.trim() },
      include: { owner: { select: { name: true } } },
    });

    await this.prisma.auditLog.create({
      data: { action: 'FILE_RENAMED', userId: user.id, projectId, fileId, metadata: { oldName: file.name, newName: body.name.trim() } },
    });

    return { success: true, data: { id: updated.id, name: updated.name } };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  @Delete(':fileId')
  async deleteFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    const user = req.user;

    const file = await this.prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) {
      throw new HttpException(
        { success: false, error: { code: 'NOT_FOUND', message: 'File not found' } },
        HttpStatus.NOT_FOUND,
      );
    }

    const canDelete = user.isMasterAdmin || file.ownerId === user.id;
    if (!canDelete) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'No delete permission' } },
        HttpStatus.FORBIDDEN,
      );
    }

    // Audit log BEFORE delete (file record must exist for FK constraint)
    await this.prisma.auditLog.create({
      data: {
        action: 'FILE_DELETED',
        userId: user.id,
        projectId,
        fileId: file.id,
        metadata: { fileName: file.name },
      },
    });

    // Delete from disk then database
    this.storageService.deleteFile(file.storageKey);
    await this.prisma.file.delete({ where: { id: fileId } });

    return { success: true, data: { message: 'File deleted successfully' } };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async checkUploadPermission(projectId: string, user: any): Promise<boolean> {
    if (user.isMasterAdmin) return true;
    // Any project member can upload — no role check
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    return !!member;
  }

  private async checkViewPermission(projectId: string, user: any): Promise<boolean> {
    if (user.isMasterAdmin) return true;
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    return !!member;
  }
}
