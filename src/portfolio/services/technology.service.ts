import { Injectable } from '@nestjs/common';
import { TechnologyRepository } from '../repositories/technology.repository';
import { Technology } from '../models/technology.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class TechnologyService {
  constructor(private readonly repository: TechnologyRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async addOrUpdate(data: DeepPartial<Technology> | DeepPartial<Technology>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
