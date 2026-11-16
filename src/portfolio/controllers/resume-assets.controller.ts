import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { LocalResumeStorageService } from '../services/local-resume-storage.service';

@Controller('assets/resumes')
export class ResumeAssetsController {
  constructor(private readonly storage: LocalResumeStorageService) {}

  @Public()
  @Get(':filename')
  async read(@Param('filename') filename: string): Promise<StreamableFile> {
    const file = await this.storage.read(filename);
    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${file.fileName}"`,
      length: file.size,
    });
  }
}
