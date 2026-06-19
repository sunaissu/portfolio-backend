import { Injectable } from '@nestjs/common';
import { ExperienceRoleRepository } from '../repositories/experience-role.repository';
import { ExperienceRole } from '../models/experience-role.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExperienceRoleService {
  constructor(private readonly repository: ExperienceRoleRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<ExperienceRole> | DeepPartial<ExperienceRole>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.deleteByExperienceId(id);
  }
}
