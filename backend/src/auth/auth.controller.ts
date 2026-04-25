import { Controller, Post, Body, Res, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as express from 'express';

@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
}
