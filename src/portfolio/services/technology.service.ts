import { Injectable } from '@nestjs/common';
import { TechnologyRepository } from '../repositories/technology.repository';
import {
  CreateTechnologyDto,
  UpdateTechnologyDto,
} from '../dtos/technology.dto';

@Injectable()
export class TechnologyService {
  constructor(private readonly repository: TechnologyRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(
    data:
      | CreateTechnologyDto
      | UpdateTechnologyDto
      | CreateTechnologyDto[]
      | UpdateTechnologyDto[],
  ) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
