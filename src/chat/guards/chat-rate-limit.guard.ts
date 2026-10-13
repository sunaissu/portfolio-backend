import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const WINDOW_MS = 60 * 1000;
const REQUEST_LIMIT = 20;
const MAX_CLIENTS = 10000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  private readonly clients = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const client = request.ip || request.socket.remoteAddress || 'unknown';
    let entry = this.clients.get(client);

    if (!entry || entry.resetAt <= now) {
      this.makeRoom(now, client);
      entry = { count: 0, resetAt: now + WINDOW_MS };
      this.clients.set(client, entry);
    }
    entry.count += 1;
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, REQUEST_LIMIT - entry.count),
    );
    if (entry.count > REQUEST_LIMIT) {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      );
      throw new HttpException(
        'Too many chat requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private makeRoom(now: number, currentClient: string) {
    if (this.clients.size < MAX_CLIENTS || this.clients.has(currentClient)) {
      return;
    }
    for (const [client, entry] of this.clients) {
      if (entry.resetAt <= now) this.clients.delete(client);
    }
    if (this.clients.size >= MAX_CLIENTS) {
      const oldest = this.clients.keys().next().value as string | undefined;
      if (oldest) this.clients.delete(oldest);
    }
  }
}
