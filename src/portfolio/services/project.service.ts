import { normalizeCaseStudy } from "../types/project-case-study";
import { requireRevision, withRevision } from '../../common/utils/revision';
import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { CreateProjectDto, UpdateProjectDto } from '../dtos/project.dto';
import { Project } from '../models/project.model';
import { ProjectLink } from '../models/project-link.model';

@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async getAll() {
    return (await this.repository.findAll()).map(withRevision);
  }

  async getPublic() {
    const projects = await this.repository.findAll();
    return projects.filter((project) => !project.isDraft);
  }

  async addOrUpdate(
    data:
      | CreateProjectDto
      | UpdateProjectDto
      | CreateProjectDto[]
      | UpdateProjectDto[],
  ) {
    if (Array.isArray(data)) {
      throw new BadRequestException('Submit one project per request.');
    }

    return this.repository.repo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(47121, 2)');
      const projectRepository = manager.getRepository(Project);
      const linkRepository = manager.getRepository(ProjectLink);
      const projectId = 'id' in data ? data.id : undefined;
      if (projectId) await projectRepository.findOne({ where: { id: projectId }, lock: { mode: 'pessimistic_write' } });
      const current = projectId
        ? await projectRepository.findOne({
            where: { id: projectId },
            relations: { links: true, technologies: true },
          })
        : null;

      if (projectId && !current) {
        throw new NotFoundException('Project not found');
      }

      if (current) requireRevision(current, 'revision' in data ? data.revision : undefined);

      if (!projectId && data.links?.some((link) => link.id !== undefined)) {
        throw new BadRequestException(
          'New projects cannot reuse existing project links',
        );
      }

      if (data.isFeatured && !current?.isFeatured) {
        const featuredCount = await projectRepository.count({
          where: { isFeatured: true },
        });
        if (featuredCount >= 2) {
          throw new HttpException(
            'Maximum of 2 featured projects allowed',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (current && data.links) {
        const existingIds = new Set(current.links.map((link) => link.id));
        const retainedIds = data.links
          .map((link) => link.id)
          .filter((id): id is number => id !== undefined);
        if (
          new Set(retainedIds).size !== retainedIds.length ||
          retainedIds.some((id) => !existingIds.has(id))
        ) {
          throw new BadRequestException(
            'Project links must belong to the project being updated',
          );
        }
        const retainedIdSet = new Set(retainedIds);
        const removedIds = current.links
          .filter((link) => !retainedIdSet.has(link.id))
          .map((link) => link.id);
        if (removedIds.length > 0) {
          await linkRepository.delete(removedIds);
        }
      }

      const { revision: _revision, ...changes } = data as UpdateProjectDto;
      if (data.caseStudy !== undefined) {
        try { changes.caseStudy = normalizeCaseStudy(data.caseStudy); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid case study"); }
        const ids = changes.caseStudy?.dependencies ?? [];
        if (ids.includes(projectId ?? -1)) throw new BadRequestException("A project cannot depend on itself");
        for (const id of ids) if (!await projectRepository.exists({ where: { id, isDraft: false } })) throw new BadRequestException("Dependencies must refer to published projects");
      }
      if (!projectId && changes.isDraft === undefined) changes.isDraft = true;
      const saved = await projectRepository.save(changes);
      return withRevision(await projectRepository.findOneOrFail({
        where: { id: saved.id },
        relations: { links: true, technologies: true },
      }));
    });
  }

  async remove(id: number, revision?: string) {
    return this.repository.remove(id, revision);
  }
}
