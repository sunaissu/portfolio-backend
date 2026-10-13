import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

@Injectable()
export class AuthService {
  private readonly isProduction: boolean;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly database: DataSource,
  ) {
    this.isProduction =
      this.configService.get<string>('environment') === 'production';
  }

  get accessCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 1000 * 60 * 15,
    };
  }

  get refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };
  }

  get csrfCookieOptions(): CookieOptions {
    return {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };
  }

  generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async generateTokens(userId: number, previous?: JwtPayload) {
    const sid = previous?.sid ?? randomUUID();
    const jti = randomUUID();
    const payload = { sub: userId, sid, jti };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...payload, tokenUse: 'access' }, { algorithm: 'HS256', expiresIn: '15m' }),
      this.jwtService.signAsync({ ...payload, tokenUse: 'refresh' }, {
        algorithm: 'HS256', secret: this.configService.getOrThrow<string>('jwt.refreshSecret'), expiresIn: '7d',
      }),
    ]);
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    if (previous) {
      const rows = await this.database.query<Array<{ id: string }>>(
        'WITH rotated AS (UPDATE portfolio_auth_session SET refresh_digest = $1, expires_at = NOW() + INTERVAL \'7 days\' WHERE id = $2 AND user_id = $3 AND refresh_digest = $4 AND expires_at > NOW() RETURNING id) SELECT id FROM rotated',
        [digest(jti), sid, userId, digest(previous.jti)],
      );
      if (rows.length !== 1) throw new UnauthorizedException('Session expired or already refreshed. Reconnect to continue.');
    } else {
      await this.database.query('DELETE FROM portfolio_auth_session WHERE expires_at <= NOW()');
      await this.database.query(
        'INSERT INTO portfolio_auth_session (id, user_id, refresh_digest, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'7 days\')',
        [sid, userId, digest(jti)],
      );
    }
    return { accessToken, refreshToken };
  }

  async requireSession(payload: JwtPayload, tokenUse: 'access' | 'refresh') {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0 || payload.tokenUse !== tokenUse ||
        typeof payload.sid !== 'string' || !uuid.test(payload.sid) || typeof payload.jti !== 'string' || !uuid.test(payload.jti)) {
      throw new UnauthorizedException();
    }
    const rows = await this.database.query<Array<{ id: string }>>(
      'SELECT id FROM portfolio_auth_session WHERE id = $1 AND user_id = $2 AND expires_at > NOW()' +
        (tokenUse === 'refresh' ? ' AND refresh_digest = $3' : ''),
      tokenUse === 'refresh' ? [payload.sid, payload.sub, createHash('sha256').update(payload.jti).digest('hex')] : [payload.sid, payload.sub],
    );
    if (rows.length !== 1) throw new UnauthorizedException();
  }

  async revokeSession(cookies: Record<string, unknown>) {
    for (const [name, tokenUse, secret] of [
      ['Refresh', 'refresh', this.configService.getOrThrow<string>('jwt.refreshSecret')],
      ['Authentication', 'access', this.configService.getOrThrow<string>('jwt.secret')],
    ]) {
      const token = cookies[name];
      if (typeof token !== 'string' || token.length > 4096) continue;
      let payload: JwtPayload;
      try { payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret, algorithms: ['HS256'], issuer: 'portfolio-backend', audience: 'portfolio-admin', ignoreExpiration: true,
      }); } catch { continue; }
      if (payload.tokenUse !== tokenUse || !Number.isSafeInteger(payload.sub) || !/^[0-9a-f-]{36}$/i.test(payload.sid || '')) continue;
      await this.database.query('DELETE FROM portfolio_auth_session WHERE id = $1 AND user_id = $2', [payload.sid, payload.sub]);
    }
  }
}
