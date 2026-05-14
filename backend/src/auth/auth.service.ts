import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.db.user.findOne({ email });
    if (!user) return null;

    const isMatch = await bcrypt.compare(pass, user.password).catch(() => false);
    
    if (isMatch) {
      const userObj = user.toObject();
      const { password, ...result } = userObj;
      
      const payload = { sub: user._id.toString(), isMasterAdmin: user.isMasterAdmin };
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
