import { Injectable } from '@nestjs/common';
import { SkillItemRepository } from '../repositories/skill-item.repository';
import { SkillItem } from '../models/skill-item.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class SkillItemService {
  constructor(private readonly repository: SkillItemRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<SkillItem> | DeepPartial<SkillItem>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
