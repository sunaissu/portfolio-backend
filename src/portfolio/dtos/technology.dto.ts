import { IsString, IsNotEmpty } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTechnologyDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateTechnologyDto extends PartialType(CreateTechnologyDto) {}
