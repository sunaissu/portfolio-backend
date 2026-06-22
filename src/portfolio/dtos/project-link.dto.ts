import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProjectLinkDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;
}

export class UpdateProjectLinkDto extends PartialType(CreateProjectLinkDto) {}
