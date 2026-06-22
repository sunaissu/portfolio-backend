import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { AdminUser } from '../models/admin-user.model';

@Injectable()
export class AdminUserRepository {
  constructor(
    @InjectRepository(AdminUser)
    public readonly repo: Repository<AdminUser>,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async findById(id: number) {
    return this.repo.findOneBy({ id });
  }

  async findByEmail(email: string) {
    return this.repo.findOneBy({ email });
  }

  async addOrUpdate(item: DeepPartial<AdminUser> | DeepPartial<AdminUser>[]) {
    if (Array.isArray(item)) {
      return this.repo.save(item);
    }
    return this.repo.save(item);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
