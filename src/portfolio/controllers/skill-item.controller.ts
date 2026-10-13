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
import { SkillItemService } from '../services/skill-item.service';
import { CreateSkillItemDto, UpdateSkillItemDto } from '../dtos/skill-item.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';

@Controller('skill-items')
export class SkillItemController {
  private readonly logger = new Logger(SkillItemController.name);

  constructor(private readonly service: SkillItemService) {}

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
  async create(@Body() data: CreateSkillItemDto) {
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
  async update(@Body() data: UpdateSkillItemDto) {
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
