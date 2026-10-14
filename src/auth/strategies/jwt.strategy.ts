import { AuthService } from '../auth.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AdminUserService } from '../../portfolio/services/admin-user.service';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private adminUserService: AdminUserService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return (request?.cookies?.Authentication as string) || null;
        },
      ]),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
      issuer: 'portfolio-backend',
      audience: 'portfolio-admin',
    });
  }

  async validate(payload: JwtPayload) {
    await this.authService.requireSession(payload, 'access');
    const user = await this.adminUserService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return Object.assign(user,{sessionId:payload.sid});
  }
}
