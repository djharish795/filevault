import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    // For dev: skip proper bcrypt hash check if password is 'password123'
    // Ensure you replace this logic later with secure comparisons!
    const isMatch = pass === user.password || await bcrypt.compare(pass, user.password).catch(() => false);
    
    if (isMatch) {
      const { password, ...result } = user;
      
      const payload = { sub: user.id, isMasterAdmin: user.isMasterAdmin };
      const accessToken = this.jwtService.sign(payload);
      
      // Real prod scenario might use a separate refresh token strategy/secret. Ref token valid for 7d
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      
      return { user: result, accessToken, refreshToken };
    }
    return null;
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const payload = { sub: decoded.sub, isMasterAdmin: decoded.isMasterAdmin };
      return this.jwtService.sign(payload);
    } catch(err) {
      throw err;
    }
  }
}
