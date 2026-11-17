import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { PersonalInfo } from '../models/personal-info.model';
import { DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../models/resume.model';
import {
  LocalResumeStorageService,
  MAX_RESUME_SIZE_BYTES,
} from './local-resume-storage.service';

@Injectable()
export class PersonalInfoService {
  private readonly logger = new Logger(PersonalInfoService.name);
  constructor(
    private readonly repository: PersonalInfoRepository,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    private readonly storage: LocalResumeStorageService,
  ) {}

  async getAll() {
    return this.repository.findAll();
  }

  async getMyPortfolioInfo() {
    return this.repository.findPortfolio();
  }

  async getResumes() {
    const resumes = await this.resumeRepository.find({
      select: { id: true, url: true, createdAt: true },
      order: { createdAt: 'DESC' },
    });
    return resumes.map(({ id, url, createdAt }) => ({ id, url, createdAt }));
  }

  async addOrUpdate(data: DeepPartial<PersonalInfo>) {
    return this.repository.addOrUpdate(data);
  }

  async uploadResume(file: Express.Multer.File) {
    this.validateResume(file);
    const uploaded = await this.storage.save(file.buffer);

    try {
      await this.resumeRepository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413301)');
        if ((await manager.getRepository(Resume).count()) >= 20) {
          throw new BadRequestException(
            'Keep at most 20 stored resumes. Remove an unused file before uploading another.',
          );
        }
        await manager.getRepository(Resume).save({
          filePath: uploaded.filePath,
          url: uploaded.url,
        });
      });
    } catch (error) {
      await this.storage.remove(uploaded.filePath).catch(() => {
        this.logger.error(
          `Resume cleanup required after failed upload: ${uploaded.filePath}`,
        );
      });
      throw error;
    }

    return {
      message: 'Resume uploaded successfully',
      url: uploaded.url,
      fileName: uploaded.filePath,
    };
  }

  async deleteResume(id: number) {
    const removed = await this.resumeRepository.manager.transaction(
      async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(78413301)');
        const repository = manager.getRepository(Resume),
          resume = await repository.findOneBy({ id });
        if (!resume) throw new NotFoundException('Resume not found');
        const tables = await manager.query<Array<{ name: string | null }>>(
          "SELECT to_regclass('public.portfolio_studio') AS name",
        );
        if (tables[0]?.name) {
          const used = await manager.query<Array<{ used: boolean }>>(
            "SELECT EXISTS(SELECT 1 FROM portfolio_studio s WHERE jsonb_path_exists(to_jsonb(s), '$.** ? (@ == $target)', jsonb_build_object('target',$1::text))) OR EXISTS(SELECT 1 FROM portfolio_studio_recovery r WHERE jsonb_path_exists(r.draft, '$.** ? (@ == $target)', jsonb_build_object('target',$1::text))) AS used",
            [resume.url],
          );
          if (used[0]?.used)
            throw new BadRequestException(
              'This resume is referenced by a draft, publication, retained version, snapshot or recovery copy. Keep it available for that content.',
            );
        }
        await repository.delete(id);
        const profile = await manager
          .getRepository(PersonalInfo)
          .findOne({ where: { resumeUrl: resume.url } });
        if (profile)
          await manager
            .getRepository(PersonalInfo)
            .update(
              { id: profile.id, resumeUrl: resume.url },
              { resumeUrl: null },
            );
        return resume;
      },
    );
    // The file stays available if the database transaction rolls back.
    try {
      await this.storage.remove(removed.filePath);
      return { message: 'Unused resume deleted' };
    } catch {
      this.logger.warn(
        `Resume metadata removed; file cleanup required: ${removed.filePath}`,
      );
      return {
        message: 'Resume removed from library; file cleanup pending',
        cleanupPending: true,
      };
    }
  }

  private validateResume(file: Express.Multer.File) {
    const isPdfName = file.originalname.toLowerCase().endsWith('.pdf');
    const hasPdfSignature = file.buffer.subarray(0, 5).toString() === '%PDF-';
    if (
      file.mimetype !== 'application/pdf' ||
      !isPdfName ||
      !hasPdfSignature ||
      file.size < 5 ||
      file.size > MAX_RESUME_SIZE_BYTES ||
      file.buffer.length !== file.size
    ) {
      throw new BadRequestException('A valid PDF up to 5 MB is required');
    }
  }
}
