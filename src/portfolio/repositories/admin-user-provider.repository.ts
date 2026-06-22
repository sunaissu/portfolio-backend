import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { AdminUserProvider } from '../models/admin-user-provider.model';

@Injectable()
export class AdminUserProviderRepository {
  constructor(
    @InjectRepository(AdminUserProvider)
    public readonly repo: Repository<AdminUserProvider>,
  ) {}

  async findAll() {
    return this.repo.find({ relations: { adminUser: true } });
  }

  async findByProviderId(provider: string, providerId: string) {
    return this.repo.findOne({
      where: { provider, providerId },
      relations: { adminUser: true },
    });
  }

  async addOrUpdate(
    item: DeepPartial<AdminUserProvider> | DeepPartial<AdminUserProvider>[],
  ) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
