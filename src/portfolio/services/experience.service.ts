import { Injectable } from '@nestjs/common';
import { ExperienceRepository } from '../repositories/experience.repository';
import { Experience } from '../models/experience.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExperienceService {
  constructor(private readonly repository: ExperienceRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<Experience> | DeepPartial<Experience>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
