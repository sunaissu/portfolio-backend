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
import { ExperienceService } from '../services/experience.service';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
} from '../dtos/experience.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { PortfolioDataService } from '../services/portfolio-data.service';

@Controller('experiences')
export class ExperienceController {
  private readonly logger = new Logger(ExperienceController.name);

  constructor(
    private readonly service: ExperienceService,
    private readonly portfolioDataService: PortfolioDataService,
  ) {}

  @Public()
  @Get()
  async getAll() {
    try {
      const portfolio = await this.portfolioDataService.getPortfolio();
      return portfolio.data.experience;
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
  async create(@Body() data: CreateExperienceDto) {
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
  async update(@Body() data: UpdateExperienceDto) {
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
