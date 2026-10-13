import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateExperienceRoleDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  experienceId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  duration?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  startDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}

export class UpdateExperienceRoleDto extends PartialType(
  CreateExperienceRoleDto,
) {
  @IsInt()
  @Min(1)
  id: number;
}
