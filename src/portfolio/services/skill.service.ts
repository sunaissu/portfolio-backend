import { Injectable } from '@nestjs/common';
import { SkillRepository } from '../repositories/skill.repository';
import { Skill } from '../models/skill.model';
import { DeepPartial } from 'typeorm';
import { CreateSkillDto, UpdateSkillDto } from '../dtos/skill.dto';

@Injectable()
export class SkillService {
  constructor(private readonly repository: SkillRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data: CreateSkillDto | UpdateSkillDto | CreateSkillDto[] | UpdateSkillDto[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
