import { Injectable } from '@nestjs/common';
import { ProjectLinkRepository } from '../repositories/project-link.repository';
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
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
