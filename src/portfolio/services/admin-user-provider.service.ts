import { Injectable } from '@nestjs/common';
import { AdminUserProviderRepository } from '../repositories/admin-user-provider.repository';
import { AdminUserProvider } from '../models/admin-user-provider.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class AdminUserProviderService {
  constructor(private readonly repository: AdminUserProviderRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async findByProviderId(provider: string, providerId: string) {
    return this.repository.findByProviderId(provider, providerId);
  }

  async addOrUpdate(
    data: DeepPartial<AdminUserProvider> | DeepPartial<AdminUserProvider>[],
  ) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
