import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { GoogleOAuthGuard } from './guards/google.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('Unconfigured administrator sign-in', () => {
  const config = new ConfigService({ auth: { mode: 'disabled' } });
  const context = { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;

  it('rejects private endpoints before attempting JWT authentication', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    expect(() => new JwtAuthGuard(reflector, config).canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows explicitly public endpoints', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    expect(new JwtAuthGuard(reflector, config).canActivate(context)).toBe(true);
  });

  it('reports unavailable Google sign-in without registering a fake client', () => {
    const guard = new GoogleOAuthGuard(config, new JwtService());
    expect(() => guard.getAuthenticateOptions(context)).toThrow(ServiceUnavailableException);
  });
});
