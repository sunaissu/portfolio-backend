import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Injectable()
export class InquiryRateGuard implements CanActivate {
  private clients = new Map<string, { count: number; reset: number }>();
  private global = { count: 0, reset: 0 };
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>(),
      response = context.switchToHttp().getResponse<Response>();
    if (
      !this.config
        .getOrThrow<string[]>('allowedOrigins')
        .includes(request.get('Origin') ?? '') ||
      !request.is('application/json')
    )
      throw new ForbiddenException('Use the portfolio contact form.');
    const now = Date.now(),
      isStatus = request.path.endsWith('/status');
    if (this.global.reset <= now)
      this.global = { count: 0, reset: now + 3600000 };
    this.global.count++;
    for (const [key, item] of this.clients)
      if (item.reset <= now) this.clients.delete(key);
    const key = `${request.ip || request.socket.remoteAddress || 'unknown'}:${isStatus ? 'status' : 'submit'}`;
    let entry = this.clients.get(key);
    if (!entry && this.clients.size < 10000) {
      entry = { count: 0, reset: now + 3600000 };
      this.clients.set(key, entry);
    }
    if (entry) entry.count++;
    if (
      !entry ||
      entry.count > (isStatus ? 60 : 5) ||
      this.global.count > 2000
    ) {
      response.setHeader('Retry-After', '3600');
      throw new HttpException(
        'Too many inquiry requests. Please try later or use the published email link.',
        429,
      );
    }
    return true;
  }
}
