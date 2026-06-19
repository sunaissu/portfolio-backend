import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { PersonalInfo } from '../models/personal-info.model';

@Injectable()
export class PersonalInfoRepository {
  constructor(
    @InjectRepository(PersonalInfo)
    public readonly repo: Repository<PersonalInfo>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async addOrUpdate(item: DeepPartial<PersonalInfo>) {
    // only my data should be in the db
    item.id = 1;
    return this.repo.save(item);
  }
}
