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
import { TechnologyService } from '../services/technology.service';
import {
  CreateTechnologyDto,
  UpdateTechnologyDto,
} from '../dtos/technology.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';

@Controller('technologies')
export class TechnologyController {
  private readonly logger = new Logger(TechnologyController.name);

  constructor(private readonly service: TechnologyService) {}

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
  async create(@Body() data: CreateTechnologyDto) {
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
  async update(@Body() data: UpdateTechnologyDto) {
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
