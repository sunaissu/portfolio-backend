import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../middleware/request-id.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = this.responseDetails(exception, status);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        JSON.stringify({
          event: 'unhandled_request_error',
          requestId: request.requestId,
          method: request.method,
          path: request.path,
          failureType:
            exception instanceof Error
              ? exception.constructor.name
              : 'UnknownError',
        }),
      );
    }

    response.status(status).json({
      statusCode: status,
      message: details.message,
      error: details.error,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }

  private responseDetails(
    exception: unknown,
    status: number,
  ): { message: string | string[]; error: string } {
    if (!(exception instanceof HttpException)) {
      return {
        message: 'An unexpected error occurred',
        error: 'Internal Server Error',
      };
    }
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { message: body, error: this.statusLabel(status) };
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message =
        typeof record.message === 'string' ||
        (Array.isArray(record.message) &&
          record.message.every((item) => typeof item === 'string'))
          ? (record.message as string | string[])
          : this.statusLabel(status);
      const error =
        typeof record.error === 'string'
          ? record.error
          : this.statusLabel(status);
      return { message, error };
    }
    return { message: this.statusLabel(status), error: this.statusLabel(status) };
  }

  private statusLabel(status: number): string {
    const label = HttpStatus[status];
    if (!label) return 'Error';
    return label
      .toLowerCase()
      .split('_')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }
}
