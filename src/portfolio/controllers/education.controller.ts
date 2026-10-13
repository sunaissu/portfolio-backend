import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { CreateEducationDto, DeleteEducationDto, UpdateEducationDto } from '../dtos/education.dto';
import { EducationService } from '../services/education.service';

@Controller('admin/education')
export class EducationController {
  constructor(private readonly service: EducationService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Post()
  create(@Body() data: CreateEducationDto) {
    return this.service.create(data);
  }

  @Put(':id')
  update(@Param('id', PositiveIntPipe) id: number, @Body() data: UpdateEducationDto) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', PositiveIntPipe) id: number, @Body() data: DeleteEducationDto) {
    return this.service.remove(id, data.version);
  }
}
