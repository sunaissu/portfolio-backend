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
import { SkillService } from '../services/skill.service';
import { CreateSkillDto, UpdateSkillDto } from '../dtos/skill.dto';
import { handleControllerError } from '../../common/utils/error.util';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { PortfolioDataService } from '../services/portfolio-data.service';

@Controller('skills')
export class SkillController {
  private readonly logger = new Logger(SkillController.name);

  constructor(
    private readonly service: SkillService,
    private readonly portfolioDataService: PortfolioDataService,
  ) {}

  @Public()
  @Get()
  async getAll() {
    try {
      const portfolio = await this.portfolioDataService.getPortfolio();
      return portfolio.data.skills;
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
  async create(@Body() data: CreateSkillDto) {
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
  async update(@Body() data: UpdateSkillDto) {
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
