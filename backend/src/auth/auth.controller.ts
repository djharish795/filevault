import { Controller, Post, Patch, Body, Res, Req, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as express from 'express';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: express.Response) {
    const { email, password } = body;
    const result = await this.authService.validateUser(email, password);
    
    if (!result) {
      throw new HttpException({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, HttpStatus.UNAUTHORIZED);
    }
    
    // Set HttpOnly refresh token
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
      // Wipe invalid cookies
      res.clearCookie('refresh_token');
      throw new HttpException({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } }, HttpStatus.UNAUTHORIZED);
    }
  }

  // ─── Update own profile (name, phone) — any authenticated user ───────────────

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Body() body: { name?: string; phone?: string },
    @Req() req: any,
  ) {
    const userId = req.user.id;

    if (!body.name?.trim() && !body.phone?.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.name !== undefined && !body.name.trim()) {
      throw new HttpException(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Name cannot be empty' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name?.trim() && { name: body.name.trim() }),
      },
      select: { id: true, name: true, email: true, isMasterAdmin: true },
    });

    return {
      success: true,
      data: {
        user: updated,
        message: 'Profile updated successfully',
      },
    };
  }
}
