import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ExperienceRole } from '../models/experience-role.model';

@Injectable()
export class ExperienceRoleRepository {
  constructor(
    @InjectRepository(ExperienceRole)
    public readonly repo: Repository<ExperienceRole>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        responsibilities: true,
      },
    });
  }

  async addOrUpdate(
    item: DeepPartial<ExperienceRole> | DeepPartial<ExperienceRole>[],
  ) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async deleteByExperienceId(experienceId: number) {
    return this.repo.delete({ experience: { id: experienceId } });
  }
}
