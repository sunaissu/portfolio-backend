import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { Project } from '../models/project.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<Project> | DeepPartial<Project>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
