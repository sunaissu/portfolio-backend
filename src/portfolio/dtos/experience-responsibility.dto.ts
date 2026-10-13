import {
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsNotEmpty,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateExperienceResponsibilityDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  roleId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}

export class UpdateExperienceResponsibilityDto extends PartialType(
  CreateExperienceResponsibilityDto,
) {
  @IsInt()
  @Min(1)
  id: number;
}

export class ReorderResponsibilitiesDto {
  @IsInt() @Min(1)
  roleId: number;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  expectedIds: number[];

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  ids: number[];
}
