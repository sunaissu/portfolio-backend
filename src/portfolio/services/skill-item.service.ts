import { Injectable } from '@nestjs/common';
import { SkillItemRepository } from '../repositories/skill-item.repository';
import { SkillItem } from '../models/skill-item.model';
import { DeepPartial } from 'typeorm';
import { CreateSkillItemDto, UpdateSkillItemDto } from '../dtos/skill-item.dto';

@Injectable()
export class SkillItemService {
  constructor(private readonly repository: SkillItemRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateSkillItemDto
      | UpdateSkillItemDto
      | CreateSkillItemDto[]
      | UpdateSkillItemDto[],
  ) {
    return this.repository.addOrUpdate(data as any);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
