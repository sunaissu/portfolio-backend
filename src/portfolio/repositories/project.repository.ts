import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Project } from '../models/project.model';

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

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
