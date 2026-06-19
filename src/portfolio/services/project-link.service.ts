import { Injectable } from '@nestjs/common';
import { ProjectLinkRepository } from '../repositories/project-link.repository';
import { ProjectLink } from '../models/project-link.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ProjectLinkService {
  constructor(private readonly repository: ProjectLinkRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<ProjectLink> | DeepPartial<ProjectLink>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
