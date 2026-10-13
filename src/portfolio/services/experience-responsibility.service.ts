import { ExperienceRole } from '../models/experience-role.model';
import { ReorderResponsibilitiesDto } from '../dtos/experience-responsibility.dto';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ExperienceResponsibilityRepository } from '../repositories/experience-responsibility.repository';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExperienceResponsibilityService {
  constructor(
    private readonly repository: ExperienceResponsibilityRepository,
  ) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | DeepPartial<ExperienceResponsibility>
      | DeepPartial<ExperienceResponsibility>[],
  ) {
    const processItem = (item: DeepPartial<ExperienceResponsibility>) => {
      const { roleId, ...rest } =
        item as DeepPartial<ExperienceResponsibility> & { roleId?: number };
      if (roleId) {
        return { ...rest, role: { id: roleId } };
      }
      return rest;
    };

    const payload = Array.isArray(data)
      ? data.map(processItem)
      : processItem(data);
    return this.repository.addOrUpdate(payload);
  }

  async reorder(data: ReorderResponsibilitiesDto) {
    return this.repository.repo.manager.transaction(async (manager) => {
      const role = await manager.getRepository(ExperienceRole).findOne({ where: { id: data.roleId }, lock: { mode: 'pessimistic_write' } });
      if (!role) throw new NotFoundException('Role not found');
      const repository = manager.getRepository(ExperienceResponsibility);
      const current = await repository.find({ where: { role: { id: data.roleId } }, order: { order: 'ASC', id: 'ASC' } });
      if (current.length !== data.expectedIds.length || current.some((item, index) => item.id !== data.expectedIds[index]) ||
          data.ids.length !== current.length || new Set(data.ids).size !== current.length || data.ids.some(id => !current.some(item => item.id === id))) {
        throw new ConflictException('Responsibilities changed. Reload the role before reordering.');
      }
      const ordered = data.ids.map((id, order) => ({ ...current.find(item => item.id === id)!, order }));
      return repository.save(ordered);
    });
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
