import { Injectable } from '@nestjs/common';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { PersonalInfo } from '../models/personal-info.model';
import { DeepPartial } from 'typeorm';
import {
  CreatePersonalInfoDto,
  UpdatePersonalInfoDto,
} from '../dtos/personal-info.dto';

@Injectable()
export class PersonalInfoService {
  constructor(private readonly repository: PersonalInfoRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async getMyPortfolioInfo() {
    return this.repository.findOne(1);
  }

  async addOrUpdate(data: DeepPartial<PersonalInfo>) {
    return this.repository.addOrUpdate(data as any);
  }
}
