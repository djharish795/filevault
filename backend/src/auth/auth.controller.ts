import { Controller, Get, Post, Patch, Body, Res, Req, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import * as express from 'express';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private db: DatabaseService,
  ) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: express.Response) {
    const { email, password } = body;
    const result = await this.authService.validateUser(email, password);
    
    if (!result) {
      throw new HttpException({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, HttpStatus.UNAUTHORIZED);
    }
    
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    };
  }

  @Post('refresh')
  async refresh(@Req() req: express.Request, @Res({ passthrough: true }) res: express.Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new HttpException({ success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' } }, HttpStatus.UNAUTHORIZED);
    }

    try {
      const accessToken = await this.authService.refreshAccessToken(refreshToken);
      return { success: true, data: { accessToken } };
    } catch (e) {
      res.clearCookie('refresh_token');
      throw new HttpException({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } }, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.db.user.findById(req.user.id).select('name email isMasterAdmin');
    if (!user) {
      throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);
    }
    return { success: true, data: { user: { id: user._id.toString(), name: user.name, email: user.email, isMasterAdmin: user.isMasterAdmin } } };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Body() body: { name?: string; phone?: string }, @Req() req: any) {
    const userId = req.user.id;

    if (!body.name?.trim() && !body.phone?.trim()) {
      throw new HttpException({ success: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update' } }, HttpStatus.BAD_REQUEST);
    }

    const user = await this.db.user.findById(userId);
    if (!user) throw new HttpException({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, HttpStatus.NOT_FOUND);

    if (body.name?.trim()) user.name = body.name.trim();
    // Phone logic omitted if not in schema, assuming only name update for now as per schema
    
    await user.save();

    return {
      success: true,
      data: {
        user: { id: user._id.toString(), name: user.name, email: user.email, isMasterAdmin: user.isMasterAdmin },
        message: 'Profile updated successfully',
      },
    };
  }
}
