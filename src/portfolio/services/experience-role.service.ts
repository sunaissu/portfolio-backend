import { Injectable } from '@nestjs/common';
import { ExperienceRoleRepository } from '../repositories/experience-role.repository';

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
    type InputDto = CreateExperienceRoleDto | UpdateExperienceRoleDto;
    const processItem = (item: InputDto) => {
      const { experienceId, ...rest } = item;
      if (experienceId) {
        return { ...rest, experience: { id: experienceId } };
      }
      return rest;
    };

    const payload = Array.isArray(data)
      ? data.map(processItem)
      : processItem(data);
    return this.repository.addOrUpdate(payload);
  }

  async remove(id: number) {
    return this.repository.deleteByExperienceId(id);
  }
}
