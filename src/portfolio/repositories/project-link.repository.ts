import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ProjectLink } from '../models/project-link.model';

@Injectable()
export class ProjectLinkRepository {
  constructor(
    @InjectRepository(ProjectLink)
    public readonly repo: Repository<ProjectLink>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async addOrUpdate(
    item: DeepPartial<ProjectLink> | DeepPartial<ProjectLink>[],
  ) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
