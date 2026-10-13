import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GoogleOAuthGuard } from './guards/google.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CSRF_COOKIE_NAME } from './csrf';

const jwt = new JwtService({ secret: 'test-only-secret-with-more-than-32-bytes', signOptions: { issuer: 'portfolio-backend', audience: 'portfolio-admin' } });
const config = new ConfigService({ environment: 'production', allowedOrigins: ['https://dashboard.example'] });
function context(path = '/api/v1/auth/google', state?: unknown, cookie?: unknown) {
  const request = { path, query: { state }, cookies: { '__Host-portfolio-oauth': cookie } };
  const response = { setHeader: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  return { request, response, context: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as unknown as ExecutionContext };
}

describe('Google login state', () => {
  const guard = new GoogleOAuthGuard(config, jwt);
  it('binds a short-lived state to a secure browser cookie', () => {
    const ctx = context(); const options = guard.getAuthenticateOptions(ctx.context);
    expect(options.state).toBeDefined();
    expect(ctx.response.cookie).toHaveBeenCalledWith('__Host-portfolio-oauth', options.state, expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600000 }));
    const callback = context('/api/v1/auth/google/callback', options.state, options.state);
    expect(guard.getAuthenticateOptions(callback.context)).toEqual({ session: false });
    expect(callback.response.clearCookie).toHaveBeenCalled();
    expect(() => jwt.verify(options.state!, { audience: 'portfolio-admin' })).toThrow();
  });
  it('rejects missing, mismatched, non-string, forged and expired states', () => {
    const valid = jwt.sign({ nonce: 'test' }, { audience: 'portfolio-oauth', expiresIn: '10m' });
    const expired = jwt.sign({ nonce: 'test' }, { audience: 'portfolio-oauth', expiresIn: -1 });
    const wrongPurpose = jwt.sign({ sub: 1 });
    for (const [state, cookie] of [[undefined, valid], [valid, undefined], [valid, valid + 'x'], [['a'], valid], ['é', 'a'], ['forged', 'forged'], [expired, expired], [wrongPurpose, wrongPurpose]]) {
      expect(() => guard.getAuthenticateOptions(context('/api/v1/auth/google/callback', state, cookie).context)).toThrow();
    }
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
