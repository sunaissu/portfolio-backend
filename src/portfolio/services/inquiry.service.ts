import {
  recordAdminAction,
  requireAuditActor,
} from '../../common/utils/admin-audit';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Inquiry } from '../models/inquiry.model';
import { Publication } from '../models/publication.model';
import { normalizeContent } from '../types/portfolio-content';
import type { InquiryDto, ReceiptDto } from '../controllers/inquiry.controller';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const matches = (value: string, expected: string) =>
  expected?.length === 64 &&
  timingSafeEqual(
    Buffer.from(hash(value), 'hex'),
    Buffer.from(expected, 'hex'),
  );
const receiptView = (item: Inquiry) => ({
  id: item.id,
  status: item.status,
  createdAt: item.createdAt,
  expiresAt: item.expiresAt,
  slot: item.slot,
});
@Injectable()
export class InquiryService implements OnModuleInit, OnModuleDestroy {
  private cleanup?: ReturnType<typeof setInterval>;
  constructor(
    @InjectRepository(Inquiry) private readonly repository: Repository<Inquiry>,
  ) {}
  onModuleInit() {
    this.cleanup = setInterval(() => {
      void this.repository
        .delete({ expiresAt: LessThanOrEqual(new Date()) })
        .catch(() => undefined);
    }, 3600000);
    this.cleanup.unref();
  }
  onModuleDestroy() {
    if (this.cleanup) clearInterval(this.cleanup);
  }
  async submit(dto: InquiryDto) {
    const name = dto.name.trim(),
      email = dto.email.trim().toLowerCase(),
      topic = dto.topic.trim(),
      message = dto.message.trim();
    if (
      !name ||
      !topic ||
      !message ||
      [name, topic, message].some((text) =>
        Array.from(text).some(
          (char) =>
            char.charCodeAt(0) < 32 && !['\n', '\t', '\r'].includes(char),
        ),
      )
    )
      throw new BadRequestException(
        'Complete the name, topic and message fields with plain text.',
      );
    const timezone = dto.timezone ?? 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Choose a valid timezone.');
    }
    const requestHash = hash(
      JSON.stringify({
        name,
        email,
        topic,
        message,
        slotId: dto.slotId ?? null,
        timezone,
      }),
    );
    return this.storage(() =>
      this.repository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413294)');
        const repository = manager.getRepository(Inquiry),
          now = new Date();
        await repository.delete({ expiresAt: LessThanOrEqual(now) });
        const prior = await repository.findOne({
          where: { id: dto.id },
          select: {
            id: true,
            receiptHash: true,
            requestHash: true,
            status: true,
            createdAt: true,
            expiresAt: true,
            slot: true,
          },
        });
        if (prior) {
          if (
            !matches(dto.receipt, prior.receiptHash) ||
            prior.requestHash !== requestHash
          )
            throw new ConflictException(
              'The request identifier was already used. Start a new inquiry.',
            );
          return receiptView(prior);
        }
        if ((await repository.count()) >= 2000)
          throw new ServiceUnavailableException(
            'The inquiry inbox is full. Please use the published email link.',
          );
        let slot: Inquiry['slot'] = null;
        if (dto.slotId) {
          const publication = await manager
            .getRepository(Publication)
            .findOneBy({ id: 1 });
          const availability = normalizeContent(
            publication?.published,
          ).availability;
          const selected = availability?.slots.find(
            (slot) =>
              slot.id === dto.slotId &&
              Date.parse(slot.startsAt) > now.getTime() &&
              Date.parse(slot.endsAt) <= now.getTime() + 21 * 86400000,
          );
          if (!selected || availability?.status === 'unavailable')
            throw new ConflictException(
              'This meeting slot is no longer available. Reload the contact page.',
            );
          const confirmed = await repository.find({
            where: { status: 'confirmed' },
            select: { slot: true },
          });
          if (
            confirmed.some(
              (item) =>
                item.slot &&
                item.slot.startsAt < selected.endsAt &&
                selected.startsAt < item.slot.endsAt,
            )
          )
            throw new ConflictException(
              'This meeting time has already been confirmed for another request.',
            );
          slot = { ...selected, timezone };
        }
        const item = await repository.save(
          repository.create({
            id: dto.id,
            receiptHash: hash(dto.receipt),
            requestHash,
            name,
            email,
            topic,
            message,
            slot,
            status: 'received',
            version: 1,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 30 * 86400000),
          }),
        );
        return receiptView(item);
      }),
    );
  }
  async status(dto: ReceiptDto) {
    const item = await this.storage(() =>
      this.repository.findOne({
        where: { id: dto.id, expiresAt: MoreThan(new Date()) },
        select: {
          id: true,
          receiptHash: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          slot: true,
        },
      }),
    );
    if (!item || !matches(dto.receipt, item.receiptHash))
      throw new NotFoundException('This receipt is invalid or expired.');
    return receiptView(item);
  }
  async list(page: number) {
    return this.storage(async () => {
      await this.repository.delete({ expiresAt: LessThanOrEqual(new Date()) });
      const [items, total] = await this.repository.findAndCount({
        where: { expiresAt: MoreThan(new Date()) },
        order: { createdAt: 'DESC', id: 'ASC' },
        take: 50,
        skip: page * 50,
      });
      return { items, total, page };
    });
  }
  async change(
    id: string,
    version: number,
    status: Inquiry['status'],
    actorId?: number,
    details?:{internalNotes?:string;replied?:boolean},
  ) {
    return this.mutate(id, version, status, actorId, details);
  }
  async remove(id: string, version: number, actorId?: number) {
    await this.mutate(id, version, null, actorId);
  }
  private mutate(
    id: string,
    version: number,
    status: Inquiry['status'] | null,
    actorId?: number,
    details?:{internalNotes?:string;replied?:boolean},
  ) {
    requireAuditActor(actorId);
    return this.storage(() =>
      this.repository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413294)');
        const repository = manager.getRepository(Inquiry),
          now = new Date();
        const item = await repository.findOne({
          where: { id, expiresAt: MoreThan(now) },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item) throw new NotFoundException('Inquiry not found or expired.');
        if (item.version !== version)
          throw new ConflictException(
            'The inquiry changed. Reload before updating it.',
          );
        if (status === null) {
          await repository.delete({ id });
          await recordAdminAction(
            manager,
            actorId,
            'inquiry.delete',
            id,
            item.version,
          );
          return null;
        }
        if (status === 'confirmed' && item.status !== 'confirmed') {
          if (!item.slot || Date.parse(item.slot.startsAt) <= now.getTime())
            throw new BadRequestException(
              'Only a future meeting request can be confirmed.',
            );
          const confirmed = await repository.find({
            where: { status: 'confirmed', expiresAt: MoreThan(now) },
          });
          if (
            confirmed.some(
              (other) =>
                other.id !== id &&
                other.slot &&
                other.slot.startsAt < item.slot!.endsAt &&
                item.slot!.startsAt < other.slot.endsAt,
            )
          )
            throw new ConflictException(
              'Another meeting already occupies this time.',
            );
        }
        item.status = status;
        if(details?.internalNotes!==undefined){if(typeof details.internalNotes!=='string'||details.internalNotes.length>4000)throw new BadRequestException('Internal notes must be at most 4000 characters.');item.internalNotes=details.internalNotes;}
        if(details?.replied!==undefined)item.repliedAt=details.replied?now:null;
        item.version++;
        await recordAdminAction(
          manager,
          actorId,
          `inquiry.${status}`,
          id,
          item.version,
        );
        return repository.save(item);
      }),
    );
  }
  private async storage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const candidate = error as {
        code?: string;
        driverError?: { code?: string };
      } | null;
      if ((candidate?.driverError?.code ?? candidate?.code) === '42P01')
        throw new ServiceUnavailableException(
          'Contact requests are not available yet. Please use the published email link.',
        );
      throw error;
    }
  }
}
