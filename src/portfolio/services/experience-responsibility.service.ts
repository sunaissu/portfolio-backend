import { Injectable } from '@nestjs/common';
import { ExperienceResponsibilityRepository } from '../repositories/experience-responsibility.repository';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';
import { DeepPartial } from 'typeorm';
import {
  CreateExperienceResponsibilityDto,
  UpdateExperienceResponsibilityDto,
} from '../dtos/experience-responsibility.dto';

@Injectable()
export class ExperienceResponsibilityService {
  constructor(
    private readonly repository: ExperienceResponsibilityRepository,
  ) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | DeepPartial<ExperienceResponsibility>
      | DeepPartial<ExperienceResponsibility>[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.deleteByRoleId(id);
  }
}
