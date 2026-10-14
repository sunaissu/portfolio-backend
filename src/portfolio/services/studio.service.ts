import { checkPublicLink, collectLinks, readPublicService } from './link-check';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { PortfolioDataService } from './portfolio-data.service';
import { ProjectService } from './project.service';
import {
  recordAdminAction,
  requireAuditActor,
} from '../../common/utils/admin-audit';
import type { PortfolioData } from '../types/portfolio-data';
export interface Revision {
  version: number;
  at: string;
  actor: number;
  data: PortfolioData;
}
export interface Trashed {
  id: string;
  section: string;
  value: unknown;
  at: string;
  actor: number;
}
interface Studio {
  id: number;
  version: number;
  draft: PortfolioData;
  published: PortfolioData | null;
  published_at: string | null;
  history: Revision[];
  trash: Trashed[];
  comments: Array<{
    id: string;
    text: string;
    actor: number;
    at: string;
    version: number;
  }>;
  settings: Record<string, unknown>;
  review_version: number | null;
  reviewed_by: number | null;
  snapshot: { version: number; at: string; data: PortfolioData } | null;
  updated_at: string;
  updated_by: number;
}
const sections = [
  'profile',
  'projects',
  'skills',
  'experience',
  'education',
  'todo',
  'content',
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
@Injectable()
export class StudioService {
  private linkChecks = new Map<number, number>();
  private activeLinkChecks = 0;
  constructor(
    private readonly db: DataSource,
    private readonly portfolio: PortfolioDataService,
    private readonly projects: ProjectService,
  ) {}
  private normalize(value: unknown) {
    try {
      return this.portfolio.normalizeDraft(value);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid draft.',
      );
    }
  }
  private async seed(actor: number): Promise<Studio> {
    const live = await this.portfolio.getPortfolio();
    if (live.isStale)
      throw new ServiceUnavailableException(
        'A fresh portfolio read is required before creating the management draft.',
      );
    const data = this.normalize({
      ...live.data,
      projects: await this.projects.getAll(),
    });
    return {
      id: 1,
      version: 0,
      draft: data,
      published: clone(live.data),
      published_at: live.generatedAt,
      history: [],
      trash: [],
      comments: [],
      settings: {},
      review_version: null,
      reviewed_by: null,
      snapshot: null,
      updated_at: live.generatedAt,
      updated_by: actor,
    };
  }
  private async read(manager: EntityManager) {
    const rows = await manager.query<Studio[]>(
      'SELECT * FROM portfolio_studio WHERE id=1',
    );
    return rows[0] || null;
  }
  private translationDigest(data: PortfolioData, locale: string) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          data.profile.title,
          data.profile.summary,
          data.projects.map((p) => [p.id, p.name, p.description]),
          data.content?.locales.find((item) => item.locale === locale),
        ]),
      )
      .digest('hex');
  }
  private view(state: Studio) {
    const reviews = (state.settings.translationReviews || {}) as Record<
      string,
      { digest: string; at: string; actor: number }
    >;
    return {
      ...state,
      localization: (state.draft.content?.locales || []).map((locale) => ({
        locale: locale.locale,
        state:
          reviews[locale.locale]?.digest ===
          this.translationDigest(state.draft, locale.locale)
            ? 'reviewed'
            : reviews[locale.locale]
              ? 'outdated'
              : 'unreviewed',
        missing: state.draft.projects
          .filter(
            (p) => !p.isDraft && !locale.projects.some((t) => t.id === p.id),
          )
          .map((p) => p.id),
        reviewedAt: reviews[locale.locale]?.at || null,
      })),
      history: state.history.map(({ version, at, actor }) => ({
        version,
        at,
        actor,
      })),
      snapshot: state.snapshot
        ? {
            version: state.snapshot.version,
            at: state.snapshot.at,
            counts: this.counts(state.snapshot.data),
          }
        : null,
    };
  }
  private counts(data: PortfolioData) {
    return Object.fromEntries(
      sections.map((section) => {
        const value = data[section as keyof PortfolioData];
        return [section, Array.isArray(value) ? value.length : value ? 1 : 0];
      }),
    );
  }
  async get(actor: number) {
    requireAuditActor(actor);
    return this.storage(async () =>
      this.view((await this.read(this.db.manager)) || (await this.seed(actor))),
    );
  }
  async revision(actor: number, version: number) {
    requireAuditActor(actor);
    const state = await this.read(this.db.manager);
    const revision = state?.history.find((item) => item.version === version);
    if (!revision) throw new NotFoundException('Version no longer retained.');
    return { schemaVersion: '1.0.0', ...revision };
  }
  async snapshot(actor: number) {
    requireAuditActor(actor);
    const state = await this.read(this.db.manager);
    if (!state?.snapshot)
      throw new NotFoundException('No approved snapshot is stored.');
    return { schemaVersion: '1.0.0', ...state.snapshot };
  }
  async change(
    actor: number,
    action: string,
    expected: number,
    input: Record<string, unknown> = {},
  ) {
    requireAuditActor(actor);
    if (!Number.isSafeInteger(expected) || expected < 0)
      throw new BadRequestException('Expected revision required.');
    return this.storage(() =>
      this.db.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413301)');
        const state = (await this.read(manager)) || (await this.seed(actor));
        if (state.version !== expected)
          throw new ConflictException(
            'The management draft changed. Load the current version and resolve each changed field.',
          );
        const now = new Date().toISOString(),
          previous = clone(state.draft);
        if (action === 'save') state.draft = this.normalize(input.data);
        else if (action === 'restore') {
          const old = state.history.find(
            (item) => item.version === input.restoreVersion,
          );
          if (!old) throw new NotFoundException('Version no longer retained.');
          state.draft = this.normalize(old.data);
        } else if (action === 'trash') {
          const section = String(input.section);
          if (
            !['projects', 'skills', 'experience', 'education', 'todo'].includes(
              section,
            ) ||
            !Number.isInteger(input.index)
          )
            throw new BadRequestException('Choose a content record.');
          const list = state.draft[section as 'projects'] as unknown[];
          const index = Number(input.index);
          if (index < 0 || index >= list.length)
            throw new NotFoundException('Record not found.');
          state.trash.unshift({
            id: randomUUID(),
            section,
            value: clone(list[index]),
            at: now,
            actor,
          });
          list.splice(index, 1);
          state.trash = state.trash.slice(0, 100);
        } else if (action === 'purge-trash') {
          const index = state.trash.findIndex((item) => item.id === input.id);
          if (index < 0)
            throw new NotFoundException('Trash item no longer retained.');
          state.trash.splice(index, 1);
        } else if (action === 'restore-trash') {
          const index = state.trash.findIndex((item) => item.id === input.id);
          if (index < 0)
            throw new NotFoundException('Trash item no longer retained.');
          const item = state.trash[index],
            list = state.draft[item.section as 'projects'] as unknown[];
          const id = (item.value as { id?: unknown })?.id;
          if (
            id !== undefined &&
            list.some((value) => (value as { id?: unknown })?.id === id)
          )
            throw new ConflictException(
              'A record with this ID already exists.',
            );
          list.push(clone(item.value));
          state.draft = this.normalize(state.draft);
          state.trash.splice(index, 1);
        } else if (action === 'comment') {
          if (
            typeof input.text !== 'string' ||
            !input.text.trim() ||
            input.text.length > 2000
          )
            throw new BadRequestException(
              'Review comments must be 1–2000 characters.',
            );
          state.comments.push({
            id: randomUUID(),
            text: input.text.trim(),
            actor,
            at: now,
            version: state.version,
          });
          state.comments = state.comments.slice(-100);
        } else if (action === 'approve') {
          this.ready(state.draft);
          state.review_version = state.version + 1;
          state.reviewed_by = actor;
        } else if (action === 'publish') {
          if (state.review_version !== state.version)
            throw new ConflictException(
              'Approve the exact saved version before publishing.',
            );
          this.ready(state.draft);
          state.published = this.portfolio.publicProjection(state.draft);
          state.published_at = now;
        } else if (action === 'snapshot') {
          if (!state.published)
            throw new BadRequestException(
              'Publish a reviewed release before promoting its snapshot.',
            );
          state.snapshot = {
            version: state.version,
            at: now,
            data: this.portfolio.publicProjection(state.published),
          };
        } else if (action === 'restore-snapshot') {
          if (!state.snapshot)
            throw new NotFoundException('No snapshot is stored.');
          state.draft = this.normalize(state.snapshot.data);
        } else if (action === 'translation-review') {
          const locale = String(input.locale);
          if (
            !state.draft.content?.locales.some((item) => item.locale === locale)
          )
            throw new BadRequestException('Choose an existing translation.');
          state.settings = {
            ...state.settings,
            translationReviews: {
              ...((state.settings.translationReviews as Record<
                string,
                unknown
              >) || {}),
              [locale]: {
                digest: this.translationDigest(state.draft, locale),
                at: now,
                actor,
              },
            },
          };
        } else if (action === 'settings')
          state.settings = {
            ...this.settings(input.settings),
            translationReviews: state.settings.translationReviews || {},
          };
        else throw new BadRequestException('Unknown management action.');
        if (
          [
            'save',
            'restore',
            'trash',
            'restore-trash',
            'restore-snapshot',
          ].includes(action)
        ) {
          state.history.unshift({
            version: state.version,
            at: state.updated_at,
            actor: state.updated_by,
            data: previous,
          });
          state.history = state.history.slice(0, 20);
          while (Buffer.byteLength(JSON.stringify(state.history)) > 4 * 1048576)
            state.history.pop();
          state.review_version = null;
          state.reviewed_by = null;
        } else if (action !== 'approve') {
          state.review_version = null;
          state.reviewed_by = null;
        }
        if (Buffer.byteLength(JSON.stringify(state.trash)) > 150000)
          throw new BadRequestException(
            'Trash exceeds its storage limit. Restore or explicitly purge trash records before deleting more.',
          );
        state.version++;
        state.updated_at = now;
        state.updated_by = actor;
        await manager.query(
          'INSERT INTO portfolio_studio(id,version,draft,published,published_at,history,trash,comments,settings,review_version,reviewed_by,snapshot,updated_at,updated_by) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version,draft=EXCLUDED.draft,published=EXCLUDED.published,published_at=EXCLUDED.published_at,history=EXCLUDED.history,trash=EXCLUDED.trash,comments=EXCLUDED.comments,settings=EXCLUDED.settings,review_version=EXCLUDED.review_version,reviewed_by=EXCLUDED.reviewed_by,snapshot=EXCLUDED.snapshot,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by',
          [
            state.version,
            state.draft,
            state.published,
            state.published_at,
            JSON.stringify(state.history),
            JSON.stringify(state.trash),
            JSON.stringify(state.comments),
            state.settings,
            state.review_version,
            state.reviewed_by,
            state.snapshot,
            now,
            actor,
          ],
        );
        await recordAdminAction(
          manager,
          actor,
          'studio.' + action,
          'portfolio',
          state.version,
        );
        return this.view(state);
      }),
    );
  }
  private ready(data: PortfolioData) {
    const publicData = this.portfolio.publicProjection(data),
      projects = new Set(publicData.projects.map((p) => p.id)),
      roles = new Set(
        publicData.experience.flatMap((e) => e.roles.map((r) => r.id)),
      ),
      content = data.content!;
    const references = [
      ...content.articles,
      ...content.faq,
      ...content.evidence,
      ...content.resumes,
      ...content.tours,
    ];
    if (
      references.some((item) =>
        item.projectIds.some((id) => !projects.has(id)),
      ) ||
      content.locales.some((locale) =>
        locale.projects.some((p) => !projects.has(p.id)),
      ) ||
      [...content.faq, ...content.evidence].some((item) =>
        item.roleIds.some((id) => !roles.has(id)),
      )
    )
      throw new BadRequestException(
        'Resolve references to unpublished or removed records before review.',
      );
    if (
      content.testimonials.some(
        (item) => item.consentDate > new Date().toISOString().slice(0, 10),
      )
    )
      throw new BadRequestException('Consent dates cannot be in the future.');
    for (const project of data.projects.filter((project) => !project.isDraft)) {
      if (!project.description.trim())
        throw new BadRequestException('Published projects need a description.');
      if (
        project.caseStudy?.dependencies.some(
          (id) => id === project.id || !projects.has(id),
        )
      )
        throw new BadRequestException(
          'Resolve project dependencies before review.',
        );
    }
  }
  private settings(value: unknown): Record<string, unknown> {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Buffer.byteLength(JSON.stringify(value)) > 32000
    )
      throw new BadRequestException('Invalid workspace settings.');
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).some(
        (key) =>
          ![
            'searches',
            'roadmap',
            'applications',
            'translationReviews',
          ].includes(key),
      )
    )
      throw new BadRequestException('Unsupported workspace setting.');
    const list = (key: string, limit: number) => {
      const rows = record[key] ?? [];
      if (
        !Array.isArray(rows) ||
        rows.length > limit ||
        rows.some(
          (row) => !row || typeof row !== 'object' || Array.isArray(row),
        )
      )
        throw new BadRequestException('Too many ' + key);
      return rows;
    };
    const text = (v: unknown, max: number) => {
      if (typeof v !== 'string' || v.length > max)
        throw new BadRequestException('Invalid setting text.');
      return v;
    };
    return {
      searches: list('searches', 20).map((r: Record<string, unknown>) => ({
        name: text(r.name, 80),
        query: text(r.query, 200),
        state: ['all', 'draft', 'public', 'missing'].includes(String(r.state))
          ? String(r.state)
          : 'all',
        section: sections.includes(String(r.section))
          ? r.section
          : (() => {
              throw new BadRequestException(
                'Choose an existing portfolio section.',
              );
            })(),
      })),
      roadmap: list('roadmap', 100).map((r: Record<string, unknown>) => {
        if (!['planned', 'in-progress', 'done'].includes(String(r.status)))
          throw new BadRequestException('Invalid roadmap status.');
        return {
          id: text(r.id, 40),
          title: text(r.title, 200),
          status: r.status,
          evidence: text(r.evidence, 1000),
          due: text(r.due, 10),
        };
      }),
      applications: list('applications', 8).map(
        (r: Record<string, unknown>) => {
          const url = new URL(text(r.url, 2000));
          if (url.protocol !== 'https:' || url.username || url.password)
            throw new BadRequestException(
              'Applications need an HTTPS URL without credentials.',
            );
          let serviceUrl = '';
          if (r.serviceUrl) {
            const endpoint = new URL(text(r.serviceUrl, 2000));
            if (
              endpoint.protocol !== 'https:' ||
              endpoint.username ||
              endpoint.password ||
              (endpoint.port && endpoint.port !== '443')
            )
              throw new BadRequestException(
                'Service status needs a public HTTPS URL on port 443.',
              );
            serviceUrl = endpoint.href;
          }
          return { name: text(r.name, 80), url: url.href, serviceUrl };
        },
      ),
    };
  }
  async validateImport(actor: number, value: unknown) {
    requireAuditActor(actor);
    const state =
        (await this.read(this.db.manager)) || (await this.seed(actor)),
      errors: Array<{ path: string; message: string }> = [];
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('Import a portfolio document.');
    const data = value as Record<string, unknown>;
    for (const section of sections) {
      const items = data[section];
      if (Array.isArray(items)) {
        for (const [index, item] of items.entries()) {
          if (index >= 500) break;
          try {
            this.normalize({ ...state.draft, [section]: [item] });
          } catch (error) {
            errors.push({
              path: section + '[' + index + ']',
              message:
                error instanceof Error ? error.message : 'Invalid record.',
            });
            if (errors.length >= 200) break;
          }
        }
      } else {
        try {
          this.normalize({ ...state.draft, [section]: items });
        } catch (error) {
          errors.push({
            path: section,
            message:
              error instanceof Error ? error.message : 'Invalid section.',
          });
        }
      }
    }
    try {
      this.normalize(data);
    } catch (error) {
      errors.push({
        path: 'document',
        message: error instanceof Error ? error.message : 'Invalid document.',
      });
    }
    return { valid: !errors.length, errors };
  }
  async recovery(actor: number) {
    requireAuditActor(actor);
    await this.db.query(
      "DELETE FROM portfolio_studio_recovery WHERE updated_at < NOW()-INTERVAL '7 days'",
    );
    const rows = await this.db.query<
      Array<{
        version: number;
        base_version: number;
        draft: unknown;
        updated_at: string;
      }>
    >(
      'SELECT version,base_version,draft,updated_at FROM portfolio_studio_recovery WHERE actor_id=$1',
      [actor],
    );
    return rows[0] || null;
  }
  async saveRecovery(
    actor: number,
    version: number,
    base: number,
    draft: unknown,
  ) {
    requireAuditActor(actor);
    if (
      Buffer.byteLength(JSON.stringify(draft) || '') > 250000 ||
      !draft ||
      typeof draft !== 'object' ||
      Array.isArray(draft)
    )
      throw new BadRequestException(
        'Recovery draft must be a bounded document.',
      );
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(78413301)');
      await manager.query('SELECT pg_advisory_xact_lock(78413295,$1)', [actor]);
      const rows = await manager.query<Array<{ version: number }>>(
        'SELECT version FROM portfolio_studio_recovery WHERE actor_id=$1',
        [actor],
      );
      if ((rows[0]?.version || 0) !== version)
        throw new ConflictException(
          'Another tab saved a recovery draft. Restore or discard it explicitly.',
        );
      const next = version + 1;
      await manager.query(
        'INSERT INTO portfolio_studio_recovery(actor_id,version,base_version,draft) VALUES($1,$2,$3,$4) ON CONFLICT(actor_id) DO UPDATE SET version=$2,base_version=$3,draft=$4,updated_at=NOW()',
        [actor, next, base, draft],
      );
      return { version: next };
    });
  }
  async discardRecovery(actor: number, version: number) {
    requireAuditActor(actor);
    const rows = await this.db.query<Array<{ version: number }>>(
      'DELETE FROM portfolio_studio_recovery WHERE actor_id=$1 AND version=$2 RETURNING version',
      [actor, version],
    );
    if (!rows.length)
      throw new ConflictException(
        'Recovery changed. Reload before discarding it.',
      );
    return { discarded: true };
  }
  async audit(actor: number, page: number) {
    requireAuditActor(actor);
    return this.db.query(
      'SELECT id,actor_id,action,entity_id,version,created_at FROM portfolio_admin_event ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1',
      [page * 50],
    );
  }
  async links(actor: number, version: number, offset: number) {
    requireAuditActor(actor);
    if (!Number.isInteger(offset) || offset < 0 || offset > 120)
      throw new BadRequestException('Invalid link batch.');
    const now = Date.now();
    for (const [id, time] of this.linkChecks)
      if (now - time > 60000) this.linkChecks.delete(id);
    if (
      this.activeLinkChecks >= 3 ||
      now - (this.linkChecks.get(actor) || 0) < 1000
    )
      throw new ConflictException(
        'Wait before starting another link-check batch.',
      );
    this.linkChecks.set(actor, now);
    this.activeLinkChecks++;
    try {
      const state = await this.read(this.db.manager);
      if (!state || state.version !== version)
        throw new ConflictException(
          'Save and reload the exact draft before checking links.',
        );
      const all = collectLinks(state.draft),
        batch = all.slice(offset, offset + 6),
        results: Array<{ url: string; status: number | null; result: string }> =
          [];
      for (let i = 0; i < batch.length; i += 3)
        results.push(
          ...(await Promise.all(batch.slice(i, i + 3).map(checkPublicLink))),
        );
      await recordAdminAction(
        this.db.manager,
        actor,
        'studio.link-check',
        'portfolio',
        version,
      );
      return {
        version,
        total: all.length,
        offset,
        next: offset + batch.length,
        checkedAt: new Date().toISOString(),
        results,
      };
    } finally {
      this.activeLinkChecks--;
    }
  }
  async projectStatus(actor: number, version: number, index: number) {
    requireAuditActor(actor);
    if (!Number.isInteger(index) || index < 0 || index > 7)
      throw new BadRequestException('Choose a configured project.');
    const now = Date.now();
    for (const [id, time] of this.linkChecks)
      if (now - time > 60000) this.linkChecks.delete(id);
    if (
      this.activeLinkChecks >= 3 ||
      now - (this.linkChecks.get(actor) || 0) < 1000
    )
      throw new ConflictException('Wait before checking another service.');
    this.linkChecks.set(actor, now);
    this.activeLinkChecks++;
    try {
      const state = await this.read(this.db.manager);
      if (!state || state.version !== version)
        throw new ConflictException('Reload the saved workspace settings.');
      const applications =
          (state.settings.applications as Array<{
            name: string;
            serviceUrl?: string;
          }>) || [],
        app = applications[index];
      if (!app?.serviceUrl)
        throw new BadRequestException(
          'Save a public service-info URL for this project first.',
        );
      try {
        return {
          name: app.name,
          ...(await readPublicService(app.serviceUrl)),
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return {
          name: app.name,
          status: 'unavailable',
          version: null,
          reportedAt: null,
          checkedAt: new Date().toISOString(),
        };
      }
    } finally {
      this.activeLinkChecks--;
    }
  }
  async status(actor: number) {
    requireAuditActor(actor);
    return {
      name: 'Portfolio',
      apiVersion: '1',
      version: process.env.npm_package_version || 'unknown',
      checkedAt: new Date().toISOString(),
      health: this.portfolio.getHealth(),
      capabilities: [
        'drafts',
        'releases',
        'history',
        'trash',
        'snapshots',
        'audit',
        'inquiries',
        'sessions',
      ],
    };
  }
  private async storage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const code =
        (error as { code?: string; driverError?: { code?: string } })
          ?.driverError?.code || (error as { code?: string })?.code;
      if (code === '42P01')
        throw new ServiceUnavailableException(
          'Apply the management-studio migration before using this workspace.',
        );
      throw error;
    }
  }
}
