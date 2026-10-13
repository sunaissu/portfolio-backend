import {
  recordAdminAction,
  requireAuditActor,
} from '../../common/utils/admin-audit';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publication } from '../models/publication.model';
import { Project } from '../models/project.model';
import { ExperienceRole } from '../models/experience-role.model';
import {
  emptyContent,
  normalizeContent,
  type PortfolioContent,
} from '../types/portfolio-content';

@Injectable()
export class PublicationService {
  constructor(
    @InjectRepository(Publication)
    private readonly repository: Repository<Publication>,
  ) {}
  private empty() {
    return {
      id: 1,
      version: 0,
      draft: emptyContent(),
      published: null,
      publishedAt: null,
      history: [],
    };
  }
  private view(item: Publication) {
    return {
      ...item,
      history: item.history.map(({ version, savedAt }) => ({
        version,
        savedAt,
      })),
    };
  }
  async get() {
    return this.storage(async () =>
      this.view((await this.repository.findOneBy({ id: 1 })) ?? this.empty()),
    );
  }
  async getPublicOrNull() {
    try {
      const value = await this.get();
      return normalizeContent(value.published);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return null;
      throw error;
    }
  }
  async change(
    action: 'save' | 'publish' | 'restore' | 'unpublish',
    version: number,
    content?: unknown,
    restoreVersion?: number,
    actorId?: number,
  ) {
    requireAuditActor(actorId);
    let normalized: PortfolioContent | undefined;
    try {
      if (action === 'save') normalized = normalizeContent(content);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid publication.',
      );
    }
    return this.storage(() =>
      this.repository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413293)');
        const repository = manager.getRepository(Publication);
        const item =
          (await repository.findOne({
            where: { id: 1 },
            lock: { mode: 'pessimistic_write' },
          })) ?? repository.create(this.empty());
        if (item.version !== version)
          throw new ConflictException(
            'The publication changed. Reload it and review your edits before saving.',
          );
        const next =
          action === 'restore'
            ? item.history.find((entry) => entry.version === restoreVersion)
                ?.content
            : normalized;
        if (action === 'restore' && !next)
          throw new BadRequestException(
            'That saved version is no longer available.',
          );
        if (action === 'save' || action === 'restore') {
          item.history = [
            {
              version: item.version,
              savedAt: new Date().toISOString(),
              content: item.draft,
            },
            ...item.history,
          ].slice(0, 20);
          item.draft = normalizeContent(next);
        }
        if (action === 'publish') {
          const draft = normalizeContent(item.draft);
          const projects = await manager
            .getRepository(Project)
            .find({ where: { isDraft: false }, select: { id: true } });
          const roles = await manager
            .getRepository(ExperienceRole)
            .find({ select: { id: true } });
          const projectIds = new Set(projects.map((project) => project.id)),
            roleIds = new Set(roles.map((role) => role.id));
          const references = [
            ...draft.articles,
            ...draft.faq,
            ...draft.evidence,
            ...draft.resumes,
            ...draft.tours,
          ];
          if (
            references.some((item) =>
              item.projectIds.some((id) => !projectIds.has(id)),
            ) ||
            draft.locales.some((locale) =>
              locale.projects.some((project) => !projectIds.has(project.id)),
            ) ||
            [...draft.faq, ...draft.evidence].some((item) =>
              item.roleIds.some((id) => !roleIds.has(id)),
            )
          )
            throw new BadRequestException(
              'Publication references a project or experience entry that is not public.',
            );
          if (
            draft.testimonials.some(
              (item) =>
                item.consentDate > new Date().toISOString().slice(0, 10),
            )
          )
            throw new BadRequestException(
              'Publication consent cannot be dated in the future.',
            );
          item.published = draft;
          item.publishedAt = new Date();
        }
        if (action === 'unpublish') {
          item.published = null;
          item.publishedAt = null;
        }
        item.version += 1;
        await recordAdminAction(
          manager,
          actorId,
          `publication.${action}`,
          'publication',
          item.version,
        );
        return this.view(await repository.save(item));
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
          'Apply the publication database migration before editing publication content.',
        );
      throw error;
    }
  }
}
