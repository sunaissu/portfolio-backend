import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

function canonical(value: unknown, field = ""): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.map(item => canonical(item));
    // SQL relation reads have no guaranteed row order; authored lists do.
    return ['links', 'technologies', 'items', 'roles', 'responsibilities'].includes(field)
      ? items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : items;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'revision').sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item, key)]));
  return value;
}
export function recordRevision(value: object): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function withRevision<T extends object>(value: T): T & { revision: string } {
  return { ...value, revision: recordRevision(value) };
}
export function requireRevision(value: object, expected: unknown): void {
  if (typeof expected !== 'string' || expected !== recordRevision(value)) {
    throw new ConflictException('This record changed or has no edit revision. Reload it before saving again.');
  }
}
