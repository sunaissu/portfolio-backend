import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Skill } from '../models/skill.model';
import { SkillItem } from '../models/skill-item.model';

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
    return this.repo.manager.transaction(async (manager) => {
      const skillRepository = manager.getRepository(Skill);
      const skill = await skillRepository.findOne({
        where: { id },
        relations: { items: true },
      });
      if (!skill) return skillRepository.delete(id);

      const itemIds = skill.items.map((item) => item.id);
      if (itemIds.length > 0) {
        await manager.getRepository(SkillItem).delete(itemIds);
      }
      return skillRepository.delete(id);
    });
  }
}
