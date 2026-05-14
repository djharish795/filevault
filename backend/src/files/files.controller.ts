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
import * as multer from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';
import { r2 } from '../config/r2';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Controller('v1/projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly db: DatabaseService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
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
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    const user = req.user;
    if (!file) throw new HttpException({ success: false, error: { code: 'NO_FILE', message: 'No file selected' } }, HttpStatus.BAD_REQUEST);

    const project = await this.db.project.findById(projectId);
    if (!project) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, HttpStatus.NOT_FOUND);

    const canUpload = await this.checkUploadPermission(projectId, user);
    if (!canUpload) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No upload permission' } }, HttpStatus.FORBIDDEN);

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = extname(file.originalname);
    const safe = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 40);
    const fileName = `${timestamp}-${random}-${safe}${ext}`;

    try {
      // 1. Upload to Cloudflare R2
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const projId = new Types.ObjectId(projectId);
      const uId = new Types.ObjectId(user.id);
      const folderId = req.body?.folderId ? new Types.ObjectId(req.body.folderId) : undefined;

      // 2. Store Metadata in MongoDB
      const saved: any = await this.db.file.create({
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: fileName, // R2 Key
        projectId: projId,
        ownerId: uId,
        folderId,
      });

      if (user.isMasterAdmin) {
        const members = await this.db.projectMember.find({ projectId: projId, userId: { $ne: uId } });
        if (members.length > 0) {
          await this.db.fileAccess.insertMany(members.map(m => ({ fileId: saved._id, userId: m.userId })));
        }
      }

      await this.db.auditLog.create({
        action: 'FILE_UPLOADED',
        userId: uId,
        projectId: projId,
        fileId: saved._id,
        metadata: { fileName: file.originalname, fileSize: file.size, storage: 'R2' },
      });

      return {
        success: true,
        data: {
          id: saved._id.toString(),
          name: saved.name,
          type: saved.mimeType,
          size: saved.size,
          updatedAt: (saved as any).updatedAt.toISOString().split('T')[0],
          owner: user.name,
          permissions: { canView: true, canDownload: true, canDelete: true, canShare: true },
        },
      };
    } catch (error) {
      console.error('[R2 Upload Error]:', error);
      throw new HttpException({ success: false, error: { code: 'STORAGE_ERROR', message: 'Failed to upload to R2' } }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':fileId/download')
  async downloadFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Req() req: any, @Res() res: Response) {
    return this._serveFile(projectId, fileId, req, res, 'attachment');
  }

  @Get(':fileId/open')
  async openFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Req() req: any, @Res() res: Response) {
    return this._serveFile(projectId, fileId, req, res, 'inline');
  }

  private async _serveFile(projectId: string, fileId: string, req: any, res: Response, disposition: 'attachment' | 'inline') {
    const user = req.user;
    const file = await this.db.file.findOne({ _id: new Types.ObjectId(fileId), projectId: new Types.ObjectId(projectId) });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canView = await this.checkViewPermission(projectId, user);
    if (!canView) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No access' } }, HttpStatus.FORBIDDEN);

    try {
      // Get signed URL from R2 for serving
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: file.storageKey,
      });
      
      const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
      
      await this.db.auditLog.create({
        action: 'FILE_ACCESSED',
        userId: new Types.ObjectId(user.id),
        projectId: new Types.ObjectId(projectId),
        fileId: file._id,
        metadata: { fileName: file.name, accessType: disposition },
      });

      // Redirect to the signed URL (simplest for mobile/browser)
      return res.redirect(url);
    } catch (error) {
      console.error('[R2 Serve Error]:', error);
      throw new HttpException({ success: false, error: { code: 'SERVE_ERROR', message: 'Failed to retrieve file from R2' } }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':fileId')
  async renameFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Body() body: { name: string }, @Req() req: any) {
    const user = req.user;
    const file = await this.db.file.findOne({ _id: new Types.ObjectId(fileId), projectId: new Types.ObjectId(projectId) });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canRename = user.isMasterAdmin || file.ownerId.toString() === user.id;
    if (!canRename) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No permission' } }, HttpStatus.FORBIDDEN);

    const oldName = file.name;
    file.name = body.name.trim();
    await file.save();

    await this.db.auditLog.create({
      action: 'FILE_RENAMED',
      userId: new Types.ObjectId(user.id),
      projectId: new Types.ObjectId(projectId),
      fileId: file._id,
      metadata: { oldName, newName: file.name },
    });

    return { success: true, data: { id: file._id.toString(), name: file.name } };
  }

  @Delete(':fileId')
  async deleteFile(@Param('projectId') projectId: string, @Param('fileId') fileId: string, @Req() req: any) {
    const user = req.user;
    const file = await this.db.file.findOne({ _id: new Types.ObjectId(fileId), projectId: new Types.ObjectId(projectId) });
    if (!file) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, HttpStatus.NOT_FOUND);

    const canDelete = user.isMasterAdmin || file.ownerId.toString() === user.id;
    if (!canDelete) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'No permission' } }, HttpStatus.FORBIDDEN);

    await this.db.auditLog.create({
      action: 'FILE_DELETED',
      userId: new Types.ObjectId(user.id),
      projectId: new Types.ObjectId(projectId),
      fileId: file._id,
      metadata: { fileName: file.name },
    });

    try {
      // Delete from R2
      await r2.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: file.storageKey,
        }),
      );
    } catch (err) {
      console.warn('[R2 Delete Warning]:', err);
    }

    await this.db.file.deleteOne({ _id: file._id });

    return { success: true, data: { message: 'File deleted successfully' } };
  }

  private async checkUploadPermission(projectId: string, user: any): Promise<boolean> {
    if (user.isMasterAdmin) return true;
    const member = await this.db.projectMember.findOne({ projectId: new Types.ObjectId(projectId), userId: new Types.ObjectId(user.id) });
    return !!member;
  }

  private async checkViewPermission(projectId: string, user: any): Promise<boolean> {
    if (user.isMasterAdmin) return true;
    const member = await this.db.projectMember.findOne({ projectId: new Types.ObjectId(projectId), userId: new Types.ObjectId(user.id) });
    return !!member;
  }
}
