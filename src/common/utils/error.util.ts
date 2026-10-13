import { Logger, HttpException, HttpStatus } from '@nestjs/common';

export function handleControllerError(
  logger: Logger,
  logMessage: string,
  error: unknown,
  clientMessage: string,
  statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
): never {
  if (error instanceof HttpException) {
    throw error;
  }
  logger.error(
    JSON.stringify({
      event: 'controller_operation_failed',
      operation: logMessage,
      failureType:
        error instanceof Error ? error.constructor.name : 'UnknownError',
    }),
  );
  throw new HttpException(clientMessage, statusCode);
}
