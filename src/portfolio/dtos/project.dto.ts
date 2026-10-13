import {
  IsString,
  Validate,
  Matches,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ProjectLinkInputDto } from './project-link.dto';
import { ProjectTechnologyDto } from './technology.dto';

import { ProjectCaseStudyValidator } from './project-case-study.dto';
import type { ProjectCaseStudy } from '../types/project-case-study';

export class CreateProjectDto {
  @IsOptional()
  @Validate(ProjectCaseStudyValidator)
  caseStudy?: ProjectCaseStudy | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProjectTechnologyDto)
  technologies?: ProjectTechnologyDto[];

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(80)
  status?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProjectLinkInputDto)
  links?: ProjectLinkInputDto[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @Matches(/^[a-f0-9]{64}$/)
  revision: string;

  @IsInt()
  @Min(1)
  id: number;
}
