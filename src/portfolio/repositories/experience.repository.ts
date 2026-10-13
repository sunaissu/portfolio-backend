import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Experience } from '../models/experience.model';
import { ExperienceRole } from '../models/experience-role.model';
import { ExperienceResponsibility } from '../models/experience-responsibility.model';

@Injectable()
export class ExperienceRepository {
  constructor(
    @InjectRepository(Experience)
    public readonly repo: Repository<Experience>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: {
        roles: {
          responsibilities: true,
        },
      },
    });
  }

  async addOrUpdate(item: DeepPartial<Experience> | DeepPartial<Experience>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.manager.transaction(async (manager) => {
      const experienceRepository = manager.getRepository(Experience);
      const experience = await experienceRepository.findOne({
        where: { id },
        relations: { roles: { responsibilities: true } },
      });
      if (!experience) return experienceRepository.delete(id);

      const responsibilityIds = experience.roles.flatMap((role) =>
        role.responsibilities.map((responsibility) => responsibility.id),
      );
      if (responsibilityIds.length > 0) {
        await manager
          .getRepository(ExperienceResponsibility)
          .delete(responsibilityIds);
      }
      const roleIds = experience.roles.map((role) => role.id);
      if (roleIds.length > 0) {
        await manager.getRepository(ExperienceRole).delete(roleIds);
      }
      return experienceRepository.delete(id);
    });
  }
}
