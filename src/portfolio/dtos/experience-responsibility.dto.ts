import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateExperienceResponsibilityDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  @IsNotEmpty()
  roleId: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateExperienceResponsibilityDto extends PartialType(
  CreateExperienceResponsibilityDto,
) {}
