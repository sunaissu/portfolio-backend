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
import { ExperienceResponsibilityService } from '../services/experience-responsibility.service';
import {
  CreateExperienceResponsibilityDto,
  ReorderResponsibilitiesDto,
  UpdateExperienceResponsibilityDto,
} from '../dtos/experience-responsibility.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';

@Controller('experience-responsibilities')
export class ExperienceResponsibilityController {
  private readonly logger = new Logger(ExperienceResponsibilityController.name);

  constructor(private readonly service: ExperienceResponsibilityService) {}

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

  @Put('order')
  reorder(@Body() data: ReorderResponsibilitiesDto) {
    return this.service.reorder(data);
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
  async remove(@Param('id', PositiveIntPipe) id: number) {
    try {
      return await this.service.remove(id);
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
