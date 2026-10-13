import { requireRevision, withRevision } from '../../common/utils/revision';
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

  async findPortfolio() {
    const [profile] = await this.repo.find({ order: { id: 'ASC' }, take: 1 });
    return profile ? withRevision(profile) : null;
  }

  async addOrUpdate(item: DeepPartial<PersonalInfo> & { revision?: string }) {
    return this.repo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(47121, 1)');
      const repository = manager.getRepository(PersonalInfo);
      const [candidate] = await repository.find({ order: { id: 'ASC' }, take: 1 });
      const profile = candidate ? await repository.findOne({ where: { id: candidate.id }, lock: { mode: 'pessimistic_write' } }) : null;
      if (profile) requireRevision(profile, item.revision);
      const { revision: _revision, ...changes } = item;
      const saved = await repository.save({ ...changes, id: profile?.id });
      return withRevision(await repository.findOneByOrFail({ id: saved.id }));
    });
  }
}
