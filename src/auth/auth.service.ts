import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {recordAdminAction} from '../common/utils/admin-audit';

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

  async sessions(userId:number,current?:string){
    const rows=await this.database.query<Array<{id:string;label:string;created_at:string;expires_at:string}>>('SELECT id,label,created_at,expires_at FROM portfolio_auth_session WHERE user_id=$1 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 100',[userId]);
    return rows.map(row=>({...row,current:row.id===current}));
  }
  async revokeOtherSessions(userId:number,current:string|undefined){
    if(!current)throw new UnauthorizedException('Current session is required.');
    return this.database.transaction(async manager=>{const rows=await manager.query<Array<{count:string}>>('WITH deleted AS (DELETE FROM portfolio_auth_session WHERE user_id=$1 AND id<>$2 RETURNING id) SELECT count(*) FROM deleted',[userId,current]);await recordAdminAction(manager,userId,'session.revoke-others',current,0);return {revoked:Number(rows[0]?.count||0)};});
  }
  async manageSession(userId:number,id:string,label?:string){
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new BadRequestException('Invalid session.');
    if(label!==undefined&&(typeof label!=='string'||!label.trim()||label.length>80))throw new BadRequestException('Use a session name of 1–80 characters.');
    return this.database.transaction(async manager=>{
      const rows=label===undefined?await manager.query<Array<{id:string}>>('DELETE FROM portfolio_auth_session WHERE id=$1 AND user_id=$2 RETURNING id',[id,userId]):await manager.query<Array<{id:string}>>('UPDATE portfolio_auth_session SET label=$3 WHERE id=$1 AND user_id=$2 AND expires_at>NOW() RETURNING id',[id,userId,label.trim()]);
      if(!rows.length)throw new ConflictException('Session expired or is no longer available.');
      await recordAdminAction(manager,userId,label===undefined?'session.revoke':'session.rename',id,0);return {changed:true};
    });
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
