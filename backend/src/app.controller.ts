import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly db: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-db')
  async testDatabase() {
    try {
      const userCount = await this.db.user.countDocuments();
      const users = await this.db.user.find().select('email name isMasterAdmin');
      const projectCount = await this.db.project.countDocuments();

      const projects = await Promise.all((await this.db.project.find()).map(async (p) => {
        const memberCount = await this.db.projectMember.countDocuments({ projectId: p._id });
        const fileCount = await this.db.file.countDocuments({ projectId: p._id });
        return {
          id: p._id.toString(),
          name: p.name,
          memberCount,
          fileCount,
        };
      }));

      return {
        success: true,
        message: 'Database connection verified (MongoDB)',
        data: {
          userCount,
          users: users.map(u => ({ id: u._id.toString(), email: u.email, name: u.name, isMasterAdmin: u.isMasterAdmin })),
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
