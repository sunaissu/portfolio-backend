import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsInt,
  Min,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

class ProjectLinkFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  type: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  @MaxLength(2048)
  url: string;
}

export class ProjectLinkInputDto extends ProjectLinkFieldsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;
}

export class CreateProjectLinkDto extends ProjectLinkFieldsDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  projectId: number;
}

export class UpdateProjectLinkDto extends PartialType(CreateProjectLinkDto) {
  @IsInt()
  @Min(1)
  id: number;
}
