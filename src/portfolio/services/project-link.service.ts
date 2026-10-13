import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectLinkRepository } from '../repositories/project-link.repository';
import { ProjectRepository } from '../repositories/project.repository';
import {
  CreateProjectLinkDto,
  UpdateProjectLinkDto,
} from '../dtos/project-link.dto';

@Injectable()
export class ProjectLinkService {
  constructor(
    private readonly repository: ProjectLinkRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateProjectLinkDto
      | UpdateProjectLinkDto
      | CreateProjectLinkDto[]
      | UpdateProjectLinkDto[],
  ) {
    type InputDto = CreateProjectLinkDto | UpdateProjectLinkDto;
    const processItem = async (item: InputDto) => {
      const { projectId, ...rest } = item;
      if (!projectId) return rest;

      const project = await this.projectRepository.repo.findOne({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return { ...rest, project: { id: projectId } };
    };

    const payload = Array.isArray(data)
      ? await Promise.all(data.map(processItem))
      : await processItem(data);
    return this.repository.addOrUpdate(payload);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
