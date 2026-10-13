import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EducationRecord } from '../models/education-record.model';
import { CreateEducationDto, UpdateEducationDto } from '../dtos/education.dto';

class EducationSetupRequired extends ServiceUnavailableException {
  constructor() {
    super('Education storage is not set up. Apply the education database migration, then retry.');
  }
}

@Injectable()
export class EducationService {
  constructor(
    @InjectRepository(EducationRecord)
    private readonly repository: Repository<EducationRecord>,
  ) {}

  getAll() {
    return this.withStorage(() => this.repository.find({ order: { id: 'DESC' } }));
  }

  async getPublicOrNull() {
    try {
      return await this.getAll();
    } catch (error) {
      if (error instanceof EducationSetupRequired) return null;
      throw error;
    }
  }

  create(data: CreateEducationDto) {
    return this.withStorage(() => this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(EducationRecord);
      await manager.query('LOCK TABLE "portfolio_education" IN SHARE ROW EXCLUSIVE MODE');
      if (await repository.count() >= 100) {
        throw new BadRequestException('A maximum of 100 education entries is allowed.');
      }
      return repository.save(repository.create({
        degree: data.degree,
        institution: data.institution,
        year: data.year,
      }));
    }));
  }

  update(id: number, data: UpdateEducationDto) {
    return this.change(id, data.version, data);
  }

  async remove(id: number, version: number) {
    await this.change(id, version, null);
    return { success: true };
  }

  private change(id: number, version: number, data: CreateEducationDto | null) {
    return this.withStorage(() => this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(EducationRecord);
      const record = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) throw new NotFoundException('Education entry not found.');
      if (record.version !== version) {
        throw new ConflictException('This education entry changed. Reload it before saving or removing it.');
      }
      if (data) {
        record.degree = data.degree;
        record.institution = data.institution;
        record.year = data.year;
      } else {
        record.deletedAt = new Date();
      }
      record.version += 1;
      return repository.save(record);
    }));
  }

  private async withStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const databaseError = error as { code?: string; driverError?: { code?: string } } | null;
      if ((databaseError?.driverError?.code ?? databaseError?.code) === '42P01') {
        throw new EducationSetupRequired();
      }
      throw error;
    }
  }
}
