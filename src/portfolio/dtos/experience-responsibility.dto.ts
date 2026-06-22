import { IsString, IsNotEmpty } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateExperienceResponsibilityDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateExperienceResponsibilityDto extends PartialType(CreateExperienceResponsibilityDto) {}
