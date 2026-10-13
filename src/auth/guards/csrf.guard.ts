import { ConfigService } from '@nestjs/config';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  REQUIRE_CSRF_KEY,
} from '../csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const explicitlyRequired = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CSRF_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic && !explicitlyRequired) return true;

    const origin = request.get('Origin');
    if (!origin || !this.config.getOrThrow<string[]>('allowedOrigins').includes(origin)) {
      throw new ForbiddenException('Request origin validation failed');
    }

    const cookie = request.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
    const header = request.get(CSRF_HEADER_NAME);
    if (!cookie || !header || !this.matches(cookie, header)) {
      throw new ForbiddenException('CSRF token validation failed');
    }
    return true;
  }

  private matches(cookie: string, header: string): boolean {
    if (!TOKEN_PATTERN.test(cookie) || !TOKEN_PATTERN.test(header)) return false;
    const cookieBuffer = Buffer.from(cookie);
    const headerBuffer = Buffer.from(header);
    return (
      cookieBuffer.length === headerBuffer.length &&
      timingSafeEqual(cookieBuffer, headerBuffer)
    );
  }
}
