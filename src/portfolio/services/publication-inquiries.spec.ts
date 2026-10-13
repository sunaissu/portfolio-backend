import { normalizeContent, projectContent } from '../types/portfolio-content';
import { PublicationService } from './publication.service';
import { InquiryService } from './inquiry.service';
import { InquiryRateGuard } from './inquiry-rate.guard';
import { Inquiry } from '../models/inquiry.model';
import { Publication } from '../models/publication.model';
import { Project } from '../models/project.model';
import { InquiryDto, ReceiptDto } from '../controllers/inquiry.controller';
import { portfolioFeed } from './feed';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID, randomBytes } from 'node:crypto';

describe('publication contract and conflicts', () => {
  it('rejects malformed, private, excessive and unapproved content', () => {
    for (const input of [
      { privateNotes: 'secret' },
      {
        articles: [
          {
            id: 'item',
            title: 'Title',
            summary: 'Summary',
            body: 'Body',
            locale: 'en',
            date: '2026-02-30',
          },
        ],
      },
      { faq: [{ id: 'answer', question: 'Question', answer: 'Answer' }] },
      {
        testimonials: [
          {
            id: 'reference',
            name: 'Name',
            quote: 'Quote',
            relationship: 'Colleague',
            sourceUrl: 'javascript:alert(1)',
            consentDate: '2026-10-13',
          },
        ],
      },
      {
        availability: {
          status: 'available',
          updatedOn: '2026-10-13',
          timezone: 'Not/AZone',
        },
      },
      {
        availability: {
          status: 'available',
          updatedOn: '2026-10-13',
          timezone: 'UTC',
          slots: [
            {
              id: 'slot',
              startsAt: '2026-02-30T10:00:00Z',
              endsAt: '2026-03-02T11:00:00Z',
            },
          ],
        },
      },
      {
        resumes: [
          { id: 'fil', title: 'Filipino', locale: 'fil', projectIds: [1] },
        ],
      },
      {
        articles: Array.from({ length: 5 }, (_, i) => ({
          id: `article-${i}`,
          title: 'Title',
          summary: 'Summary',
          body: 'x'.repeat(12000),
          locale: 'en',
          date: '2026-10-13',
        })),
      },
    ])
      expect(() => normalizeContent(input)).toThrow();
  });
  it('removes unavailable references without exposing unpublished project names', () => {
    const content = normalizeContent({
      faq: [
        {
          id: 'q',
          question: 'Question',
          answer: 'Answer',
          projectIds: [1, 2],
          roleIds: [3],
        },
      ],
      locales: [
        {
          locale: 'fil',
          label: 'Filipino',
          title: 'Title',
          summary: 'Summary',
          projects: [
            {
              id: 2,
              name: 'Private project name',
              description: 'Private draft',
            },
          ],
        },
      ],
    });
    expect(projectContent(content, [1], []).faq[0]).toMatchObject({
      projectIds: [1],
      roleIds: [],
    });
    expect(JSON.stringify(projectContent(content, [1], []))).not.toContain(
      'Private project name',
    );
    expect(projectContent(content, [], []).faq).toEqual([]);
  });
  it('saves drafts without publishing, rejects stale editors, and restores without publishing', async () => {
    let current: Publication | null = null;
    const repository = {
      findOne: async () => structuredClone(current),
      findOneBy: async () => structuredClone(current),
      create: (value: Publication) => value,
      save: async (value: Publication) => {
        current = structuredClone(value);
        return structuredClone(value);
      },
    };
    const manager = {
      query: jest.fn(),
      getRepository: (type: unknown) =>
        type === Publication
          ? repository
          : {
              find: async () => (type === Project ? [{ id: 1 }] : [{ id: 2 }]),
            },
    };
    const service = new PublicationService({
      ...repository,
      manager: {
        transaction: (fn: (value: unknown) => unknown) => fn(manager),
      },
    } as never);
    const draft = normalizeContent({
      tours: [
        {
          id: 'tour',
          title: 'Reviewed tour',
          introduction: 'Public introduction',
          projectIds: [1],
        },
      ],
    });
    const saved = await service.change('save', 0, draft, undefined, 1);
    expect(saved.version).toBe(1);
    expect(saved.published).toBeNull();
    await expect(service.change('save', 0, {}, undefined, 1)).rejects.toThrow(
      'changed',
    );
    const published = await service.change(
      'publish',
      1,
      undefined,
      undefined,
      1,
    );
    expect(published.published?.tours[0].title).toBe('Reviewed tour');
    const restored = await service.change('restore', 2, undefined, 0, 1);
    expect(restored.draft.tours).toEqual([]);
    expect(restored.published?.tours).toHaveLength(1);
    expect(restored.history.every((item) => !('content' in item))).toBe(true);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(78413293)',
    );
  });
  it('escapes Atom content and only emits the supplied public records', () => {
    const result = portfolioFeed(
      {
        profile: { portfolio: 'https://example.test/', name: '<script>&name' },
        projects: [],
        content: normalizeContent({
          articles: [
            {
              id: 'article',
              title: 'A < B',
              summary: '<img src=x>',
              body: 'Body',
              date: '2026-10-13',
              locale: 'en',
            },
          ],
        }),
      } as never,
      '2026-10-13T00:00:00Z',
    );
    expect(result).toContain('&lt;script&gt;&amp;name');
    expect(result).toContain('&lt;img src=x&gt;');
    expect(result).not.toContain('<script>');
    expect(result).toContain('https://example.test/read#article-article');
  });
});

describe('private inquiries and meeting requests', () => {
  const slot = {
    id: 'slot',
    startsAt: new Date(Date.now() + 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
  };
  const dto = (): InquiryDto => ({
    id: randomUUID(),
    receipt: randomBytes(32).toString('base64url'),
    name: 'Fixture sender',
    email: 'sender@example.test',
    topic: 'Fixture question',
    message: '<script>plain text</script>',
    consent: true,
    timezone: 'UTC',
    slotId: slot.id,
  });
  function setup() {
    const records = new Map<string, Inquiry>();
    let chain = Promise.resolve();
    const repository = {
      findOne: async (options: { where: { id: string } }) =>
        structuredClone(records.get(options.where.id) ?? null),
      delete: async (options: { id?: string }) => {
        if (options.id) records.delete(options.id);
      },
      count: async () => records.size,
      create: (value: Inquiry) => value,
      save: async (value: Inquiry) => {
        records.set(value.id, structuredClone(value));
        return structuredClone(value);
      },
      find: async () =>
        [...records.values()].filter((item) => item.status === 'confirmed'),
    };
    const manager = {
      query: jest.fn(),
      getRepository: (type: unknown) =>
        type === Inquiry
          ? repository
          : {
              findOneBy: async () => ({
                published: normalizeContent({
                  availability: {
                    status: 'available',
                    workTypes: [],
                    updatedOn: '2026-10-13',
                    timezone: 'UTC',
                    slots: [slot],
                  },
                }),
              }),
            },
    };
    const service = new InquiryService({
      ...repository,
      manager: {
        transaction: (fn: (value: unknown) => Promise<unknown>) => {
          const operation = chain.then(() => fn(manager));
          chain = operation.then(
            () => undefined,
            () => undefined,
          );
          return operation;
        },
      },
    } as never);
    return { records, manager, service };
  }
  it('validates receipt entropy, consent and reply email before storage', async () => {
    expect(await validate(plainToInstance(InquiryDto, dto()))).toHaveLength(0);
    for (const fields of [
      { receipt: 'short' },
      { consent: false },
      { email: 'bad\naddress' },
      { message: 'x'.repeat(4001) },
    ])
      expect(
        (await validate(plainToInstance(InquiryDto, { ...dto(), ...fields })))
          .length,
      ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(ReceiptDto, {
            id: randomUUID(),
            receipt: 'x'.repeat(44),
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('recovers a lost response idempotently and never puts personal fields in the receipt', async () => {
    const { service, records } = setup(),
      input = dto();
    const [first, second] = await Promise.all([
      service.submit(input),
      service.submit(input),
    ]);
    expect(first).toEqual(second);
    expect(records.size).toBe(1);
    expect(Object.keys(first).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'slot',
      'status',
    ]);
    expect(records.get(input.id)?.receiptHash).not.toBe(input.receipt);
    await expect(
      service.status({
        id: input.id,
        receipt: randomBytes(32).toString('base64url'),
      }),
    ).rejects.toThrow('invalid or expired');
    await expect(
      service.submit({ ...input, message: 'Different request' }),
    ).rejects.toThrow('already used');
  });
  it('rejects stale admin edits and overlapping confirmations under the same transaction lock', async () => {
    const { service, records, manager } = setup(),
      first = dto(),
      second = dto();
    await service.submit(first);
    await service.submit(second);
    await expect(service.change(first.id, 99, 'confirmed', 1)).rejects.toThrow(
      'changed',
    );
    const result = await Promise.allSettled([
      service.change(first.id, 1, 'confirmed', 1),
      service.change(second.id, 1, 'confirmed', 1),
    ]);
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      [...records.values()].filter((item) => item.status === 'confirmed'),
    ).toHaveLength(1);
    await expect(service.submit(dto())).rejects.toThrow(
      'already been confirmed',
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(78413294)',
    );
  });
  it('rejects foreign origins and caps submissions without storing IPs in the database', () => {
    const guard = new InquiryRateGuard({
      getOrThrow: () => ['https://portfolio.test'],
    } as never);
    const context = (origin: string) => ({
      switchToHttp: () => ({
        getRequest: () => ({
          get: () => origin,
          is: () => true,
          path: '/api/v1/inquiries',
          ip: '127.0.0.1',
          socket: {},
        }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    });
    expect(() =>
      guard.canActivate(context('https://foreign.test') as never),
    ).toThrow('contact form');
    for (let i = 0; i < 5; i++)
      expect(
        guard.canActivate(context('https://portfolio.test') as never),
      ).toBe(true);
    expect(() =>
      guard.canActivate(context('https://portfolio.test') as never),
    ).toThrow('Too many');
  });
});
