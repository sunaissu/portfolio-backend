import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { SkillItem } from '../models/skill-item.model';

@Injectable()
export class SkillItemRepository {
  constructor(
    @InjectRepository(SkillItem)
    public readonly repo: Repository<SkillItem>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async addOrUpdate(item: DeepPartial<SkillItem> | DeepPartial<SkillItem>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
