import { Injectable } from '@nestjs/common';
import { SkillRepository } from '../repositories/skill.repository';
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
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
