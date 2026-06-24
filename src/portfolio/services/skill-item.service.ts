import { Injectable } from '@nestjs/common';
import { SkillItemRepository } from '../repositories/skill-item.repository';
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
    type InputDto = CreateSkillItemDto | UpdateSkillItemDto;
    const processItem = (item: InputDto) => {
      const { skillId, ...rest } = item;
      if (skillId) {
        return { ...rest, skill: { id: skillId } };
      }
      return rest;
    };

    const payload = Array.isArray(data)
      ? data.map(processItem)
      : processItem(data);
    return this.repository.addOrUpdate(payload);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
