import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTechnologyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

export class ProjectTechnologyDto extends CreateTechnologyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;
}

export class UpdateTechnologyDto extends PartialType(CreateTechnologyDto) {
  @IsInt()
  @Min(1)
  id: number;
}
