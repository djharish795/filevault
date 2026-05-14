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
      let accessibleProjectIds: Types.ObjectId[] = [];
      const uId = new Types.ObjectId(user.id);
      
      if (user.isMasterAdmin) {
        const allProjects = await this.db.project.find().select('_id');
        accessibleProjectIds = allProjects.map(p => p._id as Types.ObjectId);
      } else {
        const memberProjects = await this.db.projectMember.find({ userId: uId }).select('projectId');
        accessibleProjectIds = memberProjects.map(m => m.projectId as Types.ObjectId);
      }

      if (accessibleProjectIds.length === 0) {
        return { success: true, data: { files: [], totalCount: 0, query: query.trim() } };
      }

      const files = await this.db.file.find({
        name: { $regex: query.trim(), $options: 'i' },
        projectId: { $in: accessibleProjectIds },
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
