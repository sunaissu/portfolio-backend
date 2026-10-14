import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction) {
    const incoming = request.get('X-Request-Id');
    request.requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    if(request.path.startsWith('/api/v1/admin')||request.path.startsWith('/api/v1/auth')||!['GET','HEAD'].includes(request.method)){response.setHeader('Cache-Control','no-store, private');response.setHeader('Pragma','no-cache');}
    next();
  }
}
