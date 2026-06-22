import {
  Controller,
  Get,
  Post,
  Put,
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
@Controller('personal-info')
export class PersonalInfoController {
  private readonly logger = new Logger(PersonalInfoController.name);

  constructor(private readonly service: PersonalInfoService) {}

  @Public()
  @Get()
  async getAll() {
    try {
      return await this.service.getMyPortfolioInfo();
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to fetch data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Get('profile')
  async getPersonalInfo() {
    try {
      return await this.service.getMyPortfolioInfo();
    } catch (error) {
      this.logger.error('Database query failed', error.stack);
      throw new HttpException(
        'Failed to fetch data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Post()
  async create(@Body() data: CreatePersonalInfoDto) {
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
  async update(@Body() data: UpdatePersonalInfoDto) {
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
}
