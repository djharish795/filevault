import { Controller, Get, Query, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';

@Controller('v1/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private db: DatabaseService) {}

  @Get()
  async globalSearch(@Req() req: any, @Query('q') query?: string) {
    const user = req.user;

    if (!query || query.trim().length < 2) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Search query required' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Centralized query approach: fetch all accessible file IDs once globally
      const allowedFileIds = await this.db.getAllAccessibleFileIds(user.id, user.isMasterAdmin);

      if (allowedFileIds.size === 0) {
        return { success: true, data: { files: [], totalCount: 0, query: query.trim() } };
      }

      const files = await this.db.file.find({
        _id: { $in: Array.from(allowedFileIds).map(id => new Types.ObjectId(id)) },
        name: { $regex: query.trim(), $options: 'i' },
      })
      .populate('ownerId', 'name email')
      .populate('projectId', 'name caseNumber')
      .sort({ updatedAt: -1 })
      .limit(20);

      const formattedFiles = files.map((file: any) => ({
        id: file._id.toString(),
        name: file.name,
        type: file.mimeType,
        size: file.size,
        updatedAt: file.updatedAt.toISOString().split('T')[0],
        owner: file.ownerId?.name ?? 'Unknown',
        project: {
          id: file.projectId?._id.toString(),
          name: file.projectId?.name,
          caseNumber: file.projectId?.caseNumber,
        },
      }));

      return { success: true, data: { files: formattedFiles, totalCount: files.length, query: query.trim() } };
    } catch (error) {
      console.error('[Search] Error:', error);
      throw new HttpException(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
