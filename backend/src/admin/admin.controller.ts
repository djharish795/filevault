import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('v1/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  private guardAdmin(user: any) {
    if (!user.isMasterAdmin) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);
    }
  }

  // ─── List all users ───────────────────────────────────────────────────────────

  @Get()
  async listUsers(@Req() req: any) {
    this.guardAdmin(req.user);
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, isMasterAdmin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: { users } };
  }

  // ─── Create user ──────────────────────────────────────────────────────────────

  @Post()
  async createUser(
    @Body() body: { name: string; email: string; password: string },
    @Req() req: any,
  ) {
    this.guardAdmin(req.user);

    if (!body.name?.trim() || !body.email?.trim() || !body.password) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Name, email, and password are required' } }, HttpStatus.BAD_REQUEST);
    }

    if (body.password.length < 6) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Password must be at least 6 characters' } }, HttpStatus.BAD_REQUEST);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (existing) {
      throw new HttpException({ success: false, error: { code: 'CONFLICT', message: 'A user with this email already exists' } }, HttpStatus.CONFLICT);
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        password: hashed,
        isMasterAdmin: false,
      },
      select: { id: true, name: true, email: true, isMasterAdmin: true, createdAt: true },
    });

    await this.prisma.auditLog.create({
      data: { action: 'USER_CREATED', userId: req.user.id, metadata: { createdUserId: user.id, email: user.email } },
    });

    return { success: true, data: { user } };
  }

  // ─── Reset password ───────────────────────────────────────────────────────────

  @Patch(':id/password')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Req() req: any,
  ) {
    this.guardAdmin(req.user);

    if (!body.password || body.password.length < 6) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Password must be at least 6 characters' } }, HttpStatus.BAD_REQUEST);
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);

    const hashed = await bcrypt.hash(body.password, 10);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });

    await this.prisma.auditLog.create({
      data: { action: 'PASSWORD_RESET', userId: req.user.id, metadata: { targetUserId: id } },
    });

    return { success: true, data: { message: 'Password updated successfully' } };
  }

  // ─── Delete user ──────────────────────────────────────────────────────────────

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    this.guardAdmin(req.user);

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);
    if (target.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete admin account' } }, HttpStatus.FORBIDDEN);

    await this.prisma.user.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: { action: 'USER_DELETED', userId: req.user.id, metadata: { deletedUserId: id, email: target.email } },
    });

    return { success: true, data: { message: 'User deleted successfully' } };
  }
}
