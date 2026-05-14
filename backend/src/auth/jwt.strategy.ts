import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vault-super-secret-key-change-in-prod',
    });
  }

  async validate(payload: any) {
    const user = await this.db.user.findById(payload.sub).select('email name isMasterAdmin');
    
    if (!user) throw new UnauthorizedException();
    
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      isMasterAdmin: user.isMasterAdmin,
    };
  }
}
