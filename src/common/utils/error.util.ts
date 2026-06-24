import { Logger, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Centrally handles controller errors by logging the stack trace
 * and throwing a standardized HttpException.
 *
 * @param logger The logger instance of the controller
 * @param logMessage The message to log internally
 * @param error The error object caught in the catch block
 * @param clientMessage The message to send to the client
 * @param statusCode The HTTP status code to return (default: 500)
 */
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
  logger.error(logMessage, error instanceof Error ? error.stack : undefined);
  throw new HttpException(clientMessage, statusCode);
}
