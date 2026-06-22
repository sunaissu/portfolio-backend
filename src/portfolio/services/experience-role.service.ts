import { Injectable } from '@nestjs/common';
import { ExperienceRoleRepository } from '../repositories/experience-role.repository';
import { ExperienceRole } from '../models/experience-role.model';
import { DeepPartial } from 'typeorm';
import {
  CreateExperienceRoleDto,
  UpdateExperienceRoleDto,
} from '../dtos/experience-role.dto';

@Injectable()
export class ExperienceRoleService {
  constructor(private readonly repository: ExperienceRoleRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateExperienceRoleDto
      | UpdateExperienceRoleDto
      | CreateExperienceRoleDto[]
      | UpdateExperienceRoleDto[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.deleteByExperienceId(id);
  }
}
