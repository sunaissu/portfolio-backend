import {
  Controller, Get, Header, NotFoundException, Param, StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../models/resume.model';
import { Public } from '../../auth/decorators/public.decorator';
import { LocalResumeStorageService } from '../services/local-resume-storage.service';

@Controller('assets/resumes')
export class ResumeAssetsController {
  constructor(
    private readonly storage: LocalResumeStorageService,
    @InjectRepository(Resume) private readonly resumes: Repository<Resume>,
  ) {}

  @Public()
  @Get(':filename')
  @Header('Cache-Control', 'no-store')
  async read(@Param('filename') filename: string): Promise<StreamableFile> {
    if (!(await this.resumes.existsBy({ filePath: filename }))) {
      throw new NotFoundException('Resume not found');
    }
    const file = await this.storage.read(filename);
    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${file.fileName}"`,
      length: file.size,
    });
  }
}
