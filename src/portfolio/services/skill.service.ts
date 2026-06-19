import { Injectable } from '@nestjs/common';
import { SkillRepository } from '../repositories/skill.repository';
import { Skill } from '../models/skill.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class SkillService {
  constructor(private readonly repository: SkillRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<Skill> | DeepPartial<Skill>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
