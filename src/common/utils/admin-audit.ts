import { UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';

export function requireAuditActor(actorId: unknown): asserts actorId is number {
  if (!Number.isSafeInteger(actorId) || Number(actorId) < 1)
    throw new UnauthorizedException('Authenticated administrator required.');
}
export async function recordAdminAction(
  manager: EntityManager,
  actorId: number,
  action: string,
  entityId: string,
  version: number,
) {
  requireAuditActor(actorId);
  await manager.query(
    'INSERT INTO portfolio_admin_event (id, actor_id, action, entity_id, version, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
    [randomUUID(), actorId, action, entityId, version],
  );
}
