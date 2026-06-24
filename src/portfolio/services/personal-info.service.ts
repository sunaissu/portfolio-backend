import { Injectable } from '@nestjs/common';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { PersonalInfo } from '../models/personal-info.model';
import { DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../models/resume.model';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PersonalInfoService {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || '',
  );

  constructor(
    private readonly repository: PersonalInfoRepository,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
  ) {}

  async getAll() {
    return this.repository.findAll();
  }

  async getMyPortfolioInfo() {
    return this.repository.findOne(1);
  }

  async getResumes() {
    return this.resumeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async addOrUpdate(data: DeepPartial<PersonalInfo>) {
    return this.repository.addOrUpdate(data);
  }

  async uploadResume(file: Express.Multer.File) {
    const date = new Date();
    const dateString = date
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];

    const originalNameParts = file.originalname.split('.');
    const ext =
      originalNameParts.length > 1 ? `.${originalNameParts.pop()}` : '';
    const baseName = originalNameParts.join('.');
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9-]/g, '_');

    const fileName = `${safeBaseName}_${dateString}${ext}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from('resumes')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const personalInfo = await this.repository.findOne(1);
    const downloadName = personalInfo?.name
      ? `${personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf`
      : 'Resume.pdf';

    const { data: urlData } = this.supabase.storage
      .from('resumes')
      .getPublicUrl(filePath, {
        download: downloadName,
      });

    const newResume = this.resumeRepository.create({
      filePath: filePath,
      url: urlData.publicUrl,
    });
    await this.resumeRepository.save(newResume);

    const resumes = await this.resumeRepository.find({
      order: { createdAt: 'ASC' },
    });

    if (resumes.length > 3) {
      const toDelete = resumes.slice(0, resumes.length - 3);
      for (const oldResume of toDelete) {
        await this.supabase.storage
          .from('resumes')
          .remove([oldResume.filePath]);
        await this.resumeRepository.delete(oldResume.id);
      }
    }

    const updatedPersonalInfo = await this.repository.findOne(1);
    if (updatedPersonalInfo) {
      updatedPersonalInfo.resumeUrl = urlData.publicUrl;
      await this.repository.addOrUpdate(updatedPersonalInfo);
    } else {
      await this.repository.addOrUpdate({
        id: 1,
        resumeUrl: urlData.publicUrl,
      });
    }

    return {
      message: 'Resume uploaded successfully',
      url: urlData.publicUrl,
      fileName: uploadData?.path || fileName,
    };
  }

  async deleteResume(id: number) {
    const resume = await this.resumeRepository.findOne({ where: { id } });
    if (!resume) {
      throw new Error('Resume not found');
    }
    await this.supabase.storage.from('resumes').remove([resume.filePath]);

    await this.resumeRepository.delete(id);

    const personalInfo = await this.repository.findOne(1);
    if (personalInfo && personalInfo.resumeUrl === resume.url) {
      personalInfo.resumeUrl = '';
      await this.repository.addOrUpdate(personalInfo);
    }

    return { message: 'Resume deleted successfully' };
  }
}
