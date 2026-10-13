import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: unknown,
    info: Error | undefined,
  ): TUser {
    if (err || !user) {
      this.logger.warn(
        JSON.stringify({
          event: 'authentication_failed',
          failureType:
            err instanceof Error
              ? err.constructor.name
              : info instanceof Error
                ? info.constructor.name
                : 'MissingIdentity',
        }),
      );
      throw new UnauthorizedException('Authentication required');
    }
    return user as TUser;
  }
}
