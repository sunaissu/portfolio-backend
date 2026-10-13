import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateExperienceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(200)
  location?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  @MaxLength(2048)
  url?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {
  @IsInt()
  @Min(1)
  id: number;
}
