import { Injectable } from '@nestjs/common';
import { ExperienceResponsibilityRepository } from '../repositories/experience-responsibility.repository';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';
import { DeepPartial } from 'typeorm';

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
    const processItem = (item: DeepPartial<ExperienceResponsibility>) => {
      const { roleId, ...rest } =
        item as DeepPartial<ExperienceResponsibility> & { roleId?: number };
      if (roleId) {
        return { ...rest, role: { id: roleId } };
      }
      return rest;
    };

    const payload = Array.isArray(data)
      ? data.map(processItem)
      : processItem(data);
    return this.repository.addOrUpdate(payload);
  }

  async remove(id: number) {
    return this.repository.deleteByRoleId(id);
  }
}
