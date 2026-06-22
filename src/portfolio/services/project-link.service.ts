import { Injectable } from '@nestjs/common';
import { ProjectLinkRepository } from '../repositories/project-link.repository';
import { ProjectLink } from '../models/project-link.model';
import { DeepPartial } from 'typeorm';
import {
  CreateProjectLinkDto,
  UpdateProjectLinkDto,
} from '../dtos/project-link.dto';

@Injectable()
export class ProjectLinkService {
  constructor(private readonly repository: ProjectLinkRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateProjectLinkDto
      | UpdateProjectLinkDto
      | CreateProjectLinkDto[]
      | UpdateProjectLinkDto[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
