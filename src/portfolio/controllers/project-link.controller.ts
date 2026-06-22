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
import { ProjectLinkService } from '../services/project-link.service';
import {
  CreateProjectLinkDto,
  UpdateProjectLinkDto,
} from '../dtos/project-link.dto';
@Controller('project-links')
export class ProjectLinkController {
  private readonly logger = new Logger(ProjectLinkController.name);

  constructor(private readonly service: ProjectLinkService) {}

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
  async create(@Body() data: CreateProjectLinkDto) {
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
  async update(@Body() data: UpdateProjectLinkDto) {
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
