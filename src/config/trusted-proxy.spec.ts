import { ExecutionContext } from '@nestjs/common';
import express, { type Request } from 'express';
import { ChatRateLimitGuard } from '../chat/guards/chat-rate-limit.guard';
import { parseTrustedProxyIps } from './configuration';

function requestWithProxy(
  configured: string | undefined,
  peer: string,
  forwarded: string,
): Request {
  const app = express();
  const addresses = parseTrustedProxyIps(configured);
  app.set('trust proxy', addresses.length ? addresses : false);
  // Use Express's actual request.ip getter without opening a network listener.
  return Object.create(app.request, {
    app: { value: app },
    socket: { value: { remoteAddress: peer } },
    headers: { value: { 'x-forwarded-for': forwarded } },
  }) as Request;
}

function context(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  } as unknown as ExecutionContext;
}

describe('Trusted proxy configuration', () => {
  it('defaults to no trusted proxies and accepts only trimmed literal IPs', () => {
    expect(parseTrustedProxyIps(undefined)).toEqual([]);
    expect(parseTrustedProxyIps('  ')).toEqual([]);
    expect(parseTrustedProxyIps(' 192.0.2.10, ::1,192.0.2.10 '))
      .toEqual(['192.0.2.10', '::1']);
  });

  it.each([
    'true',
    '1',
    'loopback',
    'proxy.example',
    '192.0.2.0/24',
    '::/0',
    'http://192.0.2.10',
    '192.0.2.10:4000',
    '[::1]',
    '192.0.2.10,',
    '192.0.2.10,,::1',
  ])('rejects unsafe or malformed proxy configuration: %s', (value) => {
    expect(() => parseTrustedProxyIps(value)).toThrow('TRUSTED_PROXY_IPS');
  });

  it('ignores forwarded addresses by default and from unlisted peers', () => {
    expect(requestWithProxy(undefined, '192.0.2.10', '203.0.113.9').ip)
      .toBe('192.0.2.10');
    expect(requestWithProxy('192.0.2.10', '198.51.100.5', '203.0.113.9').ip)
      .toBe('198.51.100.5');
  });

  it('uses the forwarded client only through an explicitly trusted peer', () => {
    expect(requestWithProxy('192.0.2.10', '192.0.2.10', '203.0.113.9').ip)
      .toBe('203.0.113.9');
    expect(requestWithProxy('192.0.2.10', '::ffff:192.0.2.10', '203.0.113.9').ip)
      .toBe('203.0.113.9');
  });

  it('stops at the nearest untrusted hop instead of accepting a spoofed prefix', () => {
    const request = requestWithProxy(
      '192.0.2.10',
      '192.0.2.10',
      '203.0.113.9, 198.51.100.5',
    );
    expect(request.ip).toBe('198.51.100.5');
  });

  it('does not let untrusted forwarded headers bypass the existing 20-request limit', () => {
    const guard = new ChatRateLimitGuard();
    for (let index = 1; index <= 20; index++) {
      const request = requestWithProxy('192.0.2.10', '198.51.100.5', `203.0.113.${index}`);
      expect(guard.canActivate(context(request))).toBe(true);
    }
    const next = requestWithProxy('192.0.2.10', '198.51.100.5', '203.0.113.21');
    expect(() => guard.canActivate(context(next))).toThrow('Too many chat requests');
  });

  it('keeps separate rate-limit buckets for clients behind a trusted proxy', () => {
    const guard = new ChatRateLimitGuard();
    const first = requestWithProxy('192.0.2.10', '::ffff:192.0.2.10', '198.51.100.5');
    for (let index = 0; index < 20; index++) guard.canActivate(context(first));
    expect(() => guard.canActivate(context(first))).toThrow('Too many chat requests');
    const second = requestWithProxy('192.0.2.10', '::ffff:192.0.2.10', '198.51.100.6');
    expect(guard.canActivate(context(second))).toBe(true);
  });
});
