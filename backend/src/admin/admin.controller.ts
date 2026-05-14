import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Controller('v1/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly db: DatabaseService) {}

  private guardAdmin(user: any) {
    if (!user.isMasterAdmin) {
      throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, HttpStatus.FORBIDDEN);
    }
  }

  @Get()
  async listUsers(@Req() req: any) {
    this.guardAdmin(req.user);
    const users = await this.db.user.find().select('name email isMasterAdmin createdAt').sort({ createdAt: 1 });
    return { success: true, data: { users: users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, isMasterAdmin: u.isMasterAdmin, createdAt: (u as any).createdAt })) } };
  }

  @Post()
  async createUser(@Body() body: { name: string; email: string; password: string }, @Req() req: any) {
    this.guardAdmin(req.user);

    if (!body.name?.trim() || !body.email?.trim() || !body.password) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Name, email, and password are required' } }, HttpStatus.BAD_REQUEST);
    }

    if (body.password.length < 6) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Password must be at least 6 characters' } }, HttpStatus.BAD_REQUEST);
    }

    const existing = await this.db.user.findOne({ email: body.email.trim().toLowerCase() });
    if (existing) {
      throw new HttpException({ success: false, error: { code: 'CONFLICT', message: 'A user with this email already exists' } }, HttpStatus.CONFLICT);
    }

    const hashed = await bcrypt.hash(body.password, 10);
    const user = await this.db.user.create({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      password: hashed,
      isMasterAdmin: false,
    });

    await this.db.auditLog.create({
      action: 'USER_CREATED',
      userId: new Types.ObjectId(req.user.id),
      metadata: { createdUserId: user._id.toString(), email: user.email },
    });

    return {
      success: true,
      data: {
        user: { id: user._id.toString(), name: user.name, email: user.email, isMasterAdmin: user.isMasterAdmin, createdAt: (user as any).createdAt }
      }
    };
  }

  @Patch(':id/password')
  async resetPassword(@Param('id') id: string, @Body() body: { password: string }, @Req() req: any) {
    this.guardAdmin(req.user);

    if (!body.password || body.password.length < 6) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Password must be at least 6 characters' } }, HttpStatus.BAD_REQUEST);
    }

    const target = await this.db.user.findById(id);
    if (!target) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);

    const hashed = await bcrypt.hash(body.password, 10);
    target.password = hashed;
    await target.save();

    await this.db.auditLog.create({
      action: 'PASSWORD_RESET',
      userId: new Types.ObjectId(req.user.id),
      metadata: { targetUserId: id },
    });

    return { success: true, data: { message: 'Password updated successfully' } };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    this.guardAdmin(req.user);

    const target = await this.db.user.findById(id);
    if (!target) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);
    if (target.isMasterAdmin) throw new HttpException({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete admin account' } }, HttpStatus.FORBIDDEN);

    // Manual cascade delete for user
    const uId = target._id;
    await Promise.all([
      this.db.projectMember.deleteMany({ userId: uId }),
      this.db.folderAccess.deleteMany({ userId: uId }),
      this.db.fileAccess.deleteMany({ userId: uId }),
      this.db.message.deleteMany({ senderId: uId }),
      this.db.auditLog.deleteMany({ userId: uId }),
      this.db.user.deleteOne({ _id: uId }),
    ]);

    await this.db.auditLog.create({
      action: 'USER_DELETED',
      userId: new Types.ObjectId(req.user.id),
      metadata: { deletedUserId: id, email: target.email },
    });

    return { success: true, data: { message: 'User deleted successfully' } };
  }
}
