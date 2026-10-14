import type { JwtPayload } from './jwt-payload.interface';
import { Request } from 'express';
import { AdminUser } from '../../portfolio/models/admin-user.model';

export interface RequestWithUser extends Request {
  user: AdminUser & { sessionId?:string; refreshPayload?: JwtPayload };
}
