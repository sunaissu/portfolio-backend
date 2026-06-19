import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Experience } from '../models/experience.model';

@Injectable()
export class ExperienceRepository {
  constructor(
    @InjectRepository(Experience)
    public readonly repo: Repository<Experience>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        roles: {
          responsibilities: true,
        },
      },
    });
  }

  async addOrUpdate(item: DeepPartial<Experience> | DeepPartial<Experience>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
