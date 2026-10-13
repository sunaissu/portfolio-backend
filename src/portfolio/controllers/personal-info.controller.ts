import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PersonalInfoService } from '../services/personal-info.service';
import {
  CreatePersonalInfoDto,
  UpdatePersonalInfoDto,
} from '../dtos/personal-info.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { PortfolioDataService } from '../services/portfolio-data.service';

@Controller('personal-info')
export class PersonalInfoController {
  private readonly logger = new Logger(PersonalInfoController.name);

  constructor(
    private readonly service: PersonalInfoService,
    private readonly portfolioDataService: PortfolioDataService,
  ) {}

  @Public()
  @Get()
  async getAll() {
    try {
      const portfolio = await this.portfolioDataService.getPortfolio();
      return portfolio.data.profile;
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to fetch data',
      );
    }
  }

  @Public()
  @Get('profile')
  async getPersonalInfo() {
    try {
      const portfolio = await this.portfolioDataService.getPortfolio();
      return portfolio.data.profile;
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to fetch data',
      );
    }
  }

  @Get('resumes')
  async getResumes() {
    try {
      return await this.service.getResumes();
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to fetch resumes',
      );
    }
  }

  @Post()
  async create(@Body() data: CreatePersonalInfoDto) {
    try {
      return await this.service.addOrUpdate(data);
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to create data',
      );
    }
  }

  @Put()
  async update(@Body() data: UpdatePersonalInfoDto) {
    try {
      return await this.service.addOrUpdate(data);
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to update data',
      );
    }
  }

  @Post('resume/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException('File not provided', HttpStatus.BAD_REQUEST);
      }
      return await this.service.uploadResume(file);
    } catch (error) {
      handleControllerError(
        this.logger,
        'File upload failed',
        error,
        'Failed to upload file',
      );
    }
  }

  @Delete('resumes/:id')
  async deleteResume(@Param('id', PositiveIntPipe) id: number) {
    try {
      return await this.service.deleteResume(id);
    } catch (error) {
      handleControllerError(
        this.logger,
        'Failed to delete resume',
        error,
        'Failed to delete resume',
      );
    }
  }
}
