import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { ExperienceRoleService } from '../services/experience-role.service';
import {
  CreateExperienceRoleDto,
  UpdateExperienceRoleDto,
} from '../dtos/experience-role.dto';
@Controller('experience-roles')
export class ExperienceRoleController {
  private readonly logger = new Logger(ExperienceRoleController.name);

  constructor(private readonly service: ExperienceRoleService) {}

  @Public()
  @Get()
  async getAll() {
    try {
      return await this.service.getAll();
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to fetch data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Post()
  async create(@Body() data: CreateExperienceRoleDto) {
    try {
      return await this.service.addOrUpdate(data);
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to create data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Put()
  async update(@Body() data: UpdateExperienceRoleDto) {
    try {
      return await this.service.addOrUpdate(data);
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to update data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.service.remove(+id);
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to delete data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
