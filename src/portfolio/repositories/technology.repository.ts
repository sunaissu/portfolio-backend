import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Technology } from '../models/technology.model';

@Injectable()
export class TechnologyRepository {
  constructor(
    @InjectRepository(Technology)
    public readonly repo: Repository<Technology>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async addOrUpdate(item: DeepPartial<Technology> | DeepPartial<Technology>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
