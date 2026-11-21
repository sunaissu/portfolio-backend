import { ExecutionContext, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, CookieOptions } from 'express';

const STATE_PATTERN = /^[A-Za-z0-9_.-]+$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COOKIE_SUFFIX_PATTERN = /^[a-f0-9]{32}$/;
const REQUEST_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_PENDING_ATTEMPTS = 5;
const MAX_COOKIE_CLEANUP = 20;

type RejectionReason = 'invalid_state' | 'expired_state' | 'missing_cookie' |
  'mismatched_cookie' | 'pending_limit';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleOAuthGuard.name);

  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) { super(); }

  getAuthenticateOptions(context: ExecutionContext) {
    if (this.config.get<string>('auth.mode') === 'disabled') {
      throw new ServiceUnavailableException('Administrator sign-in has not been configured.');
    }
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const secure = this.config.get<string>('environment') === 'production';
    const legacyName = secure ? '__Host-portfolio-oauth' : 'portfolio-oauth';
    const prefix = `${legacyName}-v2-`;
    const options: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.path.endsWith('/callback')) {
      const state = request.query.state;
      if (typeof state !== 'string' || state.length > 1024 || !STATE_PATTERN.test(state)) {
        this.reject(request, 'invalid_state');
      }
      try {
        const claims = this.jwt.verify<{ nonce?: unknown; exp?: unknown }>(state, {
          algorithms: ['HS256'],
          issuer: 'portfolio-backend',
          audience: 'portfolio-oauth',
          maxAge: '10m',
        });
        if (!claims || typeof claims.nonce !== 'string' || !NONCE_PATTERN.test(claims.nonce) ||
            typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp)) {
          this.reject(request, 'invalid_state');
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        this.reject(request, error instanceof Error && error.name === 'TokenExpiredError'
          ? 'expired_state' : 'invalid_state');
      }
      const name = this.cookieName(prefix, state);
      const stored: unknown = request.cookies?.[name];
      if (typeof stored !== 'string') this.reject(request, 'missing_cookie');
      if (stored.length !== state.length || !STATE_PATTERN.test(stored) ||
          !timingSafeEqual(Buffer.from(state), Buffer.from(stored))) {
        this.reject(request, 'mismatched_cookie');
      }
      // An invalid or older callback must not consume another sign-in attempt.
      response.clearCookie(name, options);
      return { session: false };
    }

    response.clearCookie(legacyName, options);
    this.makeCookieRoom(request, response, prefix, options);
    const state = this.jwt.sign({ nonce: randomBytes(32).toString('base64url') }, {
      algorithm: 'HS256', issuer: 'portfolio-backend', audience: 'portfolio-oauth', expiresIn: '10m',
    });
    response.cookie(this.cookieName(prefix, state), state, { ...options, maxAge: 10 * 60 * 1000 });
    return { session: false, state };
  }

  private cookieName(prefix: string, state: string): string {
    return prefix + createHash('sha256').update(state).digest('hex').slice(0, 32);
  }

  private makeCookieRoom(request: Request, response: Response, prefix: string, options: CookieOptions) {
    const names = Object.keys(request.cookies ?? {}).filter((name) =>
      name.startsWith(prefix) && COOKIE_SUFFIX_PATTERN.test(name.slice(prefix.length)));
    const excess = Math.max(0, names.length - (MAX_PENDING_ATTEMPTS - 1));
    for (const name of names.slice(0, Math.min(excess, MAX_COOKIE_CLEANUP))) {
      response.clearCookie(name, options);
    }
    // Bound cleanup headers. A retry can clear another batch without issuing more cookies.
    if (excess > MAX_COOKIE_CLEANUP) this.reject(request, 'pending_limit');
    // This bounds the observed cookie set, not concurrent starts using older snapshots.
  }

  private reject(request: Request, reason: RejectionReason): never {
    const requestId = (request as Request & { requestId?: unknown }).requestId;
    this.logger.warn(JSON.stringify({
      event: 'oauth_state_rejected',
      reason,
      ...(typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId) ? { requestId } : {}),
    }));
    throw new UnauthorizedException(reason === 'expired_state'
      ? 'Sign-in expired. Start sign-in again.'
      : reason === 'pending_limit'
        ? 'Too many pending sign-in attempts. Start sign-in again.'
        : 'Sign-in verification failed. Start sign-in again.');
  }
}
