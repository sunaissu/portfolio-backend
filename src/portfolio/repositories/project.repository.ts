import { requireRevision } from '../../common/utils/revision';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Project } from '../models/project.model';
import { ProjectLink } from '../models/project-link.model';

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    public readonly repo: Repository<Project>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        links: true,
        technologies: true,
      },
    });
  }

  async addOrUpdate(item: DeepPartial<Project> | DeepPartial<Project>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number, revision?: string) {
    return this.repo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(47121, 2)');
      const projectRepository = manager.getRepository(Project);
      await projectRepository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      const project = await projectRepository.findOne({
        where: { id },
        relations: { links: true, technologies: true },
      });
      if (!project) return projectRepository.delete(id);

      requireRevision(project, revision);
      const linkIds = project.links.map((link) => link.id);
      if (linkIds.length > 0) {
        await manager.getRepository(ProjectLink).delete(linkIds);
      }
      if (project.technologies.length > 0) {
        await projectRepository
          .createQueryBuilder()
          .relation(Project, 'technologies')
          .of(project.id)
          .remove(project.technologies.map((technology) => technology.id));
      }
      return projectRepository.delete(id);
    });
  }
}
