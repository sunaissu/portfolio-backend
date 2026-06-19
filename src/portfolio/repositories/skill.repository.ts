import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Skill } from '../models/skill.model';

@Injectable()
export class SkillRepository {
  constructor(
    @InjectRepository(Skill)
    public readonly repo: Repository<Skill>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        items: true,
      },
    });
  }

  async addOrUpdate(item: DeepPartial<Skill> | DeepPartial<Skill>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
