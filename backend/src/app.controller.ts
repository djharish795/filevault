import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-db')
  async testDatabase() {
    try {
      // Test 1: Count users
      const userCount = await this.prisma.user.count();

      // Test 2: Fetch all users
      const users = await this.prisma.user.findMany({
        select: { id: true, email: true, name: true, isMasterAdmin: true },
      });

      // Test 3: Count projects
      const projectCount = await this.prisma.project.count();

      // Test 4: Fetch projects with relations
      const projects = await this.prisma.project.findMany({
        include: {
          _count: { select: { members: true, files: true } },
        },
      });

      return {
        success: true,
        message: 'Database connection verified',
        data: {
          userCount,
          users,
          projectCount,
          projects,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
