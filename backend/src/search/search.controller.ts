import { Controller, Get, Query, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private prisma: PrismaService) {}

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
      let accessibleProjectIds: string[] = [];
      
      if (user.isMasterAdmin) {
        const allProjects = await this.prisma.project.findMany({ select: { id: true } });
        accessibleProjectIds = allProjects.map(p => p.id);
      } else {
        const memberProjects = await this.prisma.projectMember.findMany({
          where: { userId: user.id },
          select: { projectId: true },
        });
        accessibleProjectIds = memberProjects.map(m => m.projectId);
      }

      if (accessibleProjectIds.length === 0) {
        return { success: true, data: { files: [], totalCount: 0, query: query.trim() } };
      }

      const files = await this.prisma.file.findMany({
        where: {
          name: { contains: query.trim(), mode: 'insensitive' },
          projectId: { in: accessibleProjectIds },
        },
        include: {
          owner: { select: { name: true, email: true } },
          project: { select: { id: true, name: true, caseNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      const formattedFiles = files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        updatedAt: file.updatedAt.toISOString().split('T')[0],
        owner: file.owner.name,
        project: { id: file.project.id, name: file.project.name, caseNumber: file.project.caseNumber },
      }));

      return { success: true, data: { files: formattedFiles, totalCount: files.length, query: query.trim() } };
    } catch (error) {
      throw new HttpException(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
