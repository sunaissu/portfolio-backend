import { Injectable } from '@nestjs/common';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { AdminUser } from '../models/admin-user.model';
import { DeepPartial } from 'typeorm';

@Injectable()
export class AdminUserService {
  constructor(private readonly repository: AdminUserRepository) {}

  async getAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    return this.repository.findById(id);
  }

  async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  async addOrUpdate(data: DeepPartial<AdminUser> | DeepPartial<AdminUser>[]) {
    return this.repository.addOrUpdate(data);
  }

  async remove(id: number) {
    return this.repository.remove(id);
  }
}
