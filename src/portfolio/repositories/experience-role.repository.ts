import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ExperienceRole } from '../models/experience-role.model';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';

@Injectable()
export class ExperienceRoleRepository {
  constructor(
    @InjectRepository(ExperienceRole)
    public readonly repo: Repository<ExperienceRole>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        responsibilities: true,
      },
    });
  }

  async addOrUpdate(
    item: DeepPartial<ExperienceRole> | DeepPartial<ExperienceRole>[],
  ) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.manager.transaction(async (manager) => {
      const roleRepository = manager.getRepository(ExperienceRole);
      const role = await roleRepository.findOne({
        where: { id },
        relations: { responsibilities: true },
      });
      if (!role) return roleRepository.delete(id);

      const responsibilityIds = role.responsibilities.map(
        (responsibility) => responsibility.id,
      );
      if (responsibilityIds.length > 0) {
        await manager
          .getRepository(ExperienceResponsibility)
          .delete(responsibilityIds);
      }
      return roleRepository.delete(id);
    });
  }
}
