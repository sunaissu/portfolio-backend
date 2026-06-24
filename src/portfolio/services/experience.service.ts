import { Injectable } from '@nestjs/common';
import { ExperienceRepository } from '../repositories/experience.repository';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
} from '../dtos/experience.dto';

@Injectable()
export class ExperienceService {
  constructor(private readonly repository: ExperienceRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateExperienceDto
      | UpdateExperienceDto
      | CreateExperienceDto[]
      | UpdateExperienceDto[],
  ) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
