import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';

@Injectable()
export class ExperienceResponsibilityRepository {
  constructor(
    @InjectRepository(ExperienceResponsibility)
    public readonly repo: Repository<ExperienceResponsibility>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async addOrUpdate(
    item:
      | DeepPartial<ExperienceResponsibility>
      | DeepPartial<ExperienceResponsibility>[],
  ) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async deleteByRoleId(roleId: number) {
    return this.repo.delete({ role: { id: roleId } });
  }
}
