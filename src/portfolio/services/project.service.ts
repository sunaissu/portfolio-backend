import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { Project } from '../models/project.model';
import { DeepPartial } from 'typeorm';
import { CreateProjectDto, UpdateProjectDto } from '../dtos/project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateProjectDto
      | UpdateProjectDto
      | CreateProjectDto[]
      | UpdateProjectDto[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
