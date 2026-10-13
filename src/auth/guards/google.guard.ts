import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, CookieOptions } from 'express';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) { super(); }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const secure = this.config.get<string>('environment') === 'production';
    const name = secure ? '__Host-portfolio-oauth' : 'portfolio-oauth';
    const options: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.path.endsWith('/callback')) {
      const state = request.query.state;
      const stored: unknown = request.cookies?.[name];
      response.clearCookie(name, options);
      if (typeof state !== 'string' || typeof stored !== 'string' || state.length > 1024 ||
          !/^[A-Za-z0-9_.-]+$/.test(state) || !/^[A-Za-z0-9_.-]+$/.test(stored) ||
          state.length !== stored.length || !timingSafeEqual(Buffer.from(state), Buffer.from(stored))) {
        throw new UnauthorizedException('Sign-in verification failed. Start sign-in again.');
      }
      try {
        this.jwt.verify(state, { algorithms: ['HS256'], issuer: 'portfolio-backend', audience: 'portfolio-oauth' });
      } catch {
        throw new UnauthorizedException('Sign-in expired. Start sign-in again.');
      }
      return { session: false };
    }
    const state = this.jwt.sign({ nonce: randomBytes(32).toString('base64url') }, {
      algorithm: 'HS256', audience: 'portfolio-oauth', expiresIn: '10m',
    });
    response.cookie(name, state, { ...options, maxAge: 10 * 60 * 1000 });
    return { session: false, state };
  }
}
