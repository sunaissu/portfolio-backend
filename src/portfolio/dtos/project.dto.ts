import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
