import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { PersonalInfo } from '../models/personal-info.model';
import { DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../models/resume.model';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class PersonalInfoService {
  private supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(PersonalInfoService.name);

  constructor(
    private readonly repository: PersonalInfoRepository,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    private readonly configService: ConfigService,
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
    const personalInfo = await this.getMyPortfolioInfo();
    if (!personalInfo) {
      throw new NotFoundException('Personal profile not found');
    }
    const supabase = this.storageClient();
    const date = new Date();
    const dateString = date
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];

    const originalNameParts = file.originalname.split('.');
    originalNameParts.pop();
    const baseName = originalNameParts.join('.');
    const safeBaseName =
      baseName.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 80) || 'resume';

    const fileName = `${safeBaseName}_${dateString}_${randomUUID()}.pdf`;
    const filePath = fileName;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const downloadName = personalInfo?.name
      ? `${personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf`
      : 'Resume.pdf';

    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(filePath, {
        download: downloadName,
      });

    try {
      await this.resumeRepository.manager.transaction(async (manager) => {
        await manager.getRepository(Resume).save({
          filePath,
          url: urlData.publicUrl,
        });
        const updated = await manager.getRepository(PersonalInfo).update(
          personalInfo.id,
          { resumeUrl: urlData.publicUrl },
        );
        if (updated.affected !== 1) {
          throw new NotFoundException('Personal profile not found');
        }
      });
    } catch (error) {
      await supabase.storage.from('resumes').remove([filePath]);
      throw error;
    }

    try {
      const resumes = await this.resumeRepository.find({
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      if (resumes.length > 3) {
        const toDelete = resumes.slice(0, resumes.length - 3);
        for (const oldResume of toDelete) {
          const currentProfile = await this.getMyPortfolioInfo();
          if (currentProfile?.resumeUrl === oldResume.url) continue;
          const { error } = await supabase.storage
            .from('resumes')
            .remove([oldResume.filePath]);
          if (error) continue;
          await this.resumeRepository.delete(oldResume.id);
        }
      }
    } catch {
      this.logger.warn('Resume saved, but old resume cleanup could not finish');
    }

    return {
      message: 'Resume uploaded successfully',
      url: urlData.publicUrl,
      fileName: uploadData?.path || fileName,
    };
  }

  async deleteResume(id: number) {
    const supabase = this.storageClient();
    const resume = await this.resumeRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    const { error } = await supabase.storage
      .from('resumes')
      .remove([resume.filePath]);
    if (error) throw new Error('Resume storage deletion failed');

    await this.resumeRepository.delete(id);

    const personalInfo = await this.getMyPortfolioInfo();
    if (personalInfo && personalInfo.resumeUrl === resume.url) {
      await this.repository.repo.update(
        { id: personalInfo.id, resumeUrl: resume.url },
        { resumeUrl: null },
      );
    }

    return { message: 'Resume deleted successfully' };
  }

  private validateResume(file: Express.Multer.File) {
    const isPdfName = file.originalname.toLowerCase().endsWith('.pdf');
    const hasPdfSignature = file.buffer.subarray(0, 5).toString() === '%PDF-';
    if (
      file.mimetype !== 'application/pdf' ||
      !isPdfName ||
      !hasPdfSignature ||
      file.size < 5 ||
      file.size > MAX_RESUME_SIZE_BYTES
    ) {
      throw new BadRequestException('A valid PDF up to 5 MB is required');
    }
  }

  private storageClient(): SupabaseClient {
    if (!this.supabase) {
      this.supabase = createClient(
        this.configService.getOrThrow<string>('storage.url'),
        this.configService.getOrThrow<string>('storage.key'),
      );
    }
    return this.supabase;
  }
}
