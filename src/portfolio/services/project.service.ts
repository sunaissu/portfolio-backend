import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { CreateProjectDto, UpdateProjectDto } from '../dtos/project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateProjectDto
      | UpdateProjectDto
      | CreateProjectDto[]
      | UpdateProjectDto[],
  ) {
    if (!Array.isArray(data) && data.isFeatured) {
      const featuredCount = await this.repository.repo.count({
        where: { isFeatured: true },
      });
      if (featuredCount >= 2) {
        let isCurrentlyFeatured = false;
        if ('id' in data && data.id) {
          const current = await this.repository.repo.findOne({
            where: { id: data.id },
          });
          isCurrentlyFeatured = current?.isFeatured || false;
        }
        if (!isCurrentlyFeatured) {
          throw new HttpException(
            'Maximum of 2 featured projects allowed',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
