import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { GoogleOAuthGuard } from './guards/google.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CSRF_COOKIE_NAME } from './csrf';

const jwt = new JwtService({ secret: 'test-only-secret-with-more-than-32-bytes', signOptions: { issuer: 'portfolio-backend', audience: 'portfolio-admin' } });
const config = new ConfigService({ environment: 'production', allowedOrigins: ['https://dashboard.example'] });
function context(path = '/api/v1/auth/google', state?: unknown, cookies: Record<string, unknown> = {}, requestId?: unknown) {
  const request = { path, query: { state }, cookies, requestId };
  const response = { setHeader: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  return { request, response, context: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as unknown as ExecutionContext };
}

describe('Google login state', () => {
  const guard = new GoogleOAuthGuard(config, jwt);
  const prefix = '__Host-portfolio-oauth-v2-';
  const nonce = 'a'.repeat(43);
  const cookieName = (state: string) => prefix + createHash('sha256').update(state).digest('hex').slice(0, 32);
  type BrowserCookies = Record<string, unknown>;

  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  function applyCookies(ctx: ReturnType<typeof context>, cookies: BrowserCookies) {
    for (const [name] of ctx.response.clearCookie.mock.calls) delete cookies[name];
    for (const [name, value] of ctx.response.cookie.mock.calls) cookies[name] = value;
  }

  function start(cookies: BrowserCookies) {
    const ctx = context('/api/v1/auth/google', undefined, { ...cookies });
    const state = guard.getAuthenticateOptions(ctx.context).state!;
    applyCookies(ctx, cookies);
    return state;
  }

  it('binds a short-lived state to a secure browser cookie', () => {
    const ctx = context(); const options = guard.getAuthenticateOptions(ctx.context);
    expect(options.state).toBeDefined();
    const name = cookieName(options.state!);
    expect(ctx.response.cookie).toHaveBeenCalledWith(name, options.state, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600000,
    });
    expect(ctx.response.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
    expect(ctx.response.clearCookie).toHaveBeenCalledWith('__Host-portfolio-oauth', {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
    });
    const claims = jwt.verify(options.state!, { audience: 'portfolio-oauth' });
    expect(claims.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(claims.exp - claims.iat).toBe(600);
    const callback = context('/api/v1/auth/google/callback', options.state, { [name]: options.state });
    expect(guard.getAuthenticateOptions(callback.context)).toEqual({ session: false });
    expect(callback.response.clearCookie).toHaveBeenCalledTimes(1);
    expect(callback.response.clearCookie.mock.calls[0][0]).toBe(name);
    expect(() => jwt.verify(options.state!, { audience: 'portfolio-admin' })).toThrow();
  });

  it('uses a non-Host cookie only outside production', () => {
    const development = new GoogleOAuthGuard(new ConfigService({ environment: 'development' }), jwt);
    const ctx = context();
    development.getAuthenticateOptions(ctx.context);
    expect(ctx.response.cookie.mock.calls[0][0]).toMatch(/^portfolio-oauth-v2-[a-f0-9]{32}$/);
    expect(ctx.response.cookie.mock.calls[0][2]).toEqual({
      httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 600000,
    });
  });

  it.each([false, true])('allows overlapping attempts in either callback order, reverse=%s', (reverse) => {
    const cookies: BrowserCookies = {};
    const states = [start(cookies), start(cookies)];
    expect(states[0]).not.toBe(states[1]);
    if (reverse) states.reverse();
    for (const state of states) {
      const callback = context('/api/v1/auth/google/callback', state, { ...cookies });
      expect(guard.getAuthenticateOptions(callback.context)).toEqual({ session: false });
      expect(callback.response.clearCookie.mock.calls.map(([name]) => name)).toEqual([cookieName(state)]);
      applyCookies(callback, cookies);
    }
    expect(cookies).toEqual({});
  });

  it('does not clear active attempts when an unrelated invalid callback arrives', () => {
    const cookies: BrowserCookies = {};
    const valid = start(cookies);
    for (const state of [undefined, ['array-state'], 'é', 'bogus-state', 'a'.repeat(1025)]) {
      const callback = context('/api/v1/auth/google/callback', state, { ...cookies });
      expect(() => guard.getAuthenticateOptions(callback.context)).toThrow('Sign-in verification failed');
      expect(callback.response.clearCookie).not.toHaveBeenCalled();
      expect(cookies[cookieName(valid)]).toBe(valid);
    }
    expect(guard.getAuthenticateOptions(context('/api/v1/auth/google/callback', valid, cookies).context))
      .toEqual({ session: false });
  });

  it('rejects a consumed attempt without consuming another pending attempt', () => {
    const cookies: BrowserCookies = {};
    const first = start(cookies), second = start(cookies);
    const callback = context('/api/v1/auth/google/callback', first, { ...cookies });
    guard.getAuthenticateOptions(callback.context);
    applyCookies(callback, cookies);
    const replay = context('/api/v1/auth/google/callback', first, { ...cookies });
    expect(() => guard.getAuthenticateOptions(replay.context)).toThrow('Sign-in verification failed');
    expect(replay.response.clearCookie).not.toHaveBeenCalled();
    expect(guard.getAuthenticateOptions(context('/api/v1/auth/google/callback', second, cookies).context))
      .toEqual({ session: false });
  });

  it('rejects forged, expired, wrong-purpose and invalid-claim states even with matching cookies', () => {
    const states = [
      jwt.sign({ nonce }, { audience: 'portfolio-oauth', expiresIn: '10m', secret: 'different-test-only-signing-secret' }),
      jwt.sign({ nonce }, { audience: 'portfolio-oauth', expiresIn: -1 }),
      jwt.sign({ nonce }, { audience: 'portfolio-admin', expiresIn: '10m' }),
      jwt.sign({ nonce }, { audience: 'portfolio-oauth', issuer: 'different-issuer', expiresIn: '10m' }),
      jwt.sign({ nonce }, { audience: 'portfolio-oauth', algorithm: 'HS384', expiresIn: '10m' }),
      jwt.sign({ nonce: 'short' }, { audience: 'portfolio-oauth', expiresIn: '10m' }),
      jwt.sign({}, { audience: 'portfolio-oauth', expiresIn: '10m' }),
      jwt.sign({ nonce }, { audience: 'portfolio-oauth' }),
    ];
    for (const state of states) {
      const callback = context('/api/v1/auth/google/callback', state, { [cookieName(state)]: state });
      expect(() => guard.getAuthenticateOptions(callback.context)).toThrow();
      expect(callback.response.clearCookie).not.toHaveBeenCalled();
    }
  });

  it('requires the matching attempt cookie and never accepts legacy or mismatched cookie values', () => {
    const state = jwt.sign({ nonce }, { audience: 'portfolio-oauth', expiresIn: '10m' });
    for (const cookies of [
      {},
      { '__Host-portfolio-oauth': state },
      { [cookieName(state)]: 'x'.repeat(state.length) },
      { [cookieName(state)]: [state] },
      { [cookieName(state)]: { state } },
    ]) {
      const callback = context('/api/v1/auth/google/callback', state, cookies);
      expect(() => guard.getAuthenticateOptions(callback.context)).toThrow('Sign-in verification failed');
      expect(callback.response.clearCookie).not.toHaveBeenCalled();
    }
  });

  it('limits sequential pending attempts without clearing unrelated cookies', () => {
    const cookies: BrowserCookies = {
      Authentication: 'test-access-cookie', Refresh: 'test-refresh-cookie',
      '__Host-portfolio-oauth': 'legacy-cookie',
      [`${prefix}unrelated`]: 'unrelated-cookie',
    };
    const states = Array.from({ length: 6 }, () => start(cookies));
    expect(cookies).not.toHaveProperty('__Host-portfolio-oauth');
    expect(cookies).not.toHaveProperty(cookieName(states[0]));
    expect(Object.keys(cookies).filter((name) => /^__Host-portfolio-oauth-v2-[a-f0-9]{32}$/.test(name)))
      .toHaveLength(5);
    expect(cookies.Authentication).toBe('test-access-cookie');
    expect(cookies.Refresh).toBe('test-refresh-cookie');
    expect(cookies[`${prefix}unrelated`]).toBe('unrelated-cookie');
    const callback = context('/api/v1/auth/google/callback', states[0], cookies);
    expect(() => guard.getAuthenticateOptions(callback.context)).toThrow();
    expect(callback.response.clearCookie).not.toHaveBeenCalled();
    expect(guard.getAuthenticateOptions(context('/api/v1/auth/google/callback', states[5], cookies).context))
      .toEqual({ session: false });
  });

  it('bounds cleanup headers for an abnormal number of recognized cookies', () => {
    const cookies: BrowserCookies = { Authentication: 'test-access-cookie' };
    for (let index = 0; index < 30; index++) cookies[prefix + index.toString(16).padStart(32, '0')] = 'invalid';
    const ctx = context('/api/v1/auth/google', undefined, { ...cookies });
    expect(() => guard.getAuthenticateOptions(ctx.context)).toThrow('Too many pending sign-in attempts');
    expect(ctx.response.cookie).not.toHaveBeenCalled();
    expect(ctx.response.clearCookie).toHaveBeenCalledTimes(21); // Legacy plus at most 20 attempt cookies.
    expect(ctx.response.clearCookie.mock.calls.some(([name]) => name === 'Authentication')).toBe(false);
    applyCookies(ctx, cookies);
    start(cookies);
    expect(Object.keys(cookies).filter((name) => name.startsWith(prefix))).toHaveLength(5);
  });

  it('logs only a rejection reason and a validated request ID', () => {
    const requestId = '11111111-2222-4333-8444-555555555555';
    const ctx = context('/api/v1/auth/google/callback', 'not-a-token', {}, requestId);
    expect(() => guard.getAuthenticateOptions(ctx.context)).toThrow();
    expect(Logger.prototype.warn).toHaveBeenLastCalledWith(JSON.stringify({
      event: 'oauth_state_rejected', reason: 'invalid_state', requestId,
    }));
    const invalidId = context('/api/v1/auth/google/callback', 'not-a-token', {}, 'not-a-valid-request-id');
    expect(() => guard.getAuthenticateOptions(invalidId.context)).toThrow();
    expect(Logger.prototype.warn).toHaveBeenLastCalledWith(JSON.stringify({
      event: 'oauth_state_rejected', reason: 'invalid_state',
    }));
  });
});

describe('Admin request CSRF', () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const guard = new CsrfGuard(reflector, config);
  function ctx(origin: string | undefined, header: string | undefined, cookie: string | undefined) {
    return { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ method: 'POST', cookies: { [CSRF_COOKIE_NAME]: cookie }, get: (key: string) => key === 'Origin' ? origin : header }) }) } as unknown as ExecutionContext;
  }
  it('requires an allowed origin as well as the double-submit token', () => {
    const token = 'a'.repeat(43);
    expect(guard.canActivate(ctx('https://dashboard.example', token, token))).toBe(true);
    for (const origin of [undefined, 'https://attacker.example', 'null']) expect(() => guard.canActivate(ctx(origin, token, token))).toThrow();
    expect(() => guard.canActivate(ctx('https://dashboard.example', token, 'b'.repeat(43)))).toThrow();
  });
});
