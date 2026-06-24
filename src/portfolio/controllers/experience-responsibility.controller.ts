import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { ExperienceResponsibilityService } from '../services/experience-responsibility.service';
import {
  CreateExperienceResponsibilityDto,
  UpdateExperienceResponsibilityDto,
} from '../dtos/experience-responsibility.dto';
import { handleControllerError } from '../../common/utils/error.util';

@Controller('experience-responsibilities')
export class ExperienceResponsibilityController {
  private readonly logger = new Logger(ExperienceResponsibilityController.name);

  constructor(private readonly service: ExperienceResponsibilityService) {}

  @Public()
  @Get()
  async getAll() {
    try {
      return await this.service.getAll();
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to fetch data',
      );
    }
  }

  @Post()
  async create(@Body() data: CreateExperienceResponsibilityDto) {
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
  async update(@Body() data: UpdateExperienceResponsibilityDto) {
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

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.service.remove(+id);
    } catch (error) {
      handleControllerError(
        this.logger,
        'Database query failed',
        error,
        'Failed to delete data',
      );
    }
  }
}
