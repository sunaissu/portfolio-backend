import { IsString, IsNotEmpty, IsOptional, IsEmail, IsUrl } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePersonalInfoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsUrl()
  @IsNotEmpty()
  linkedin: string;

  @IsUrl()
  @IsNotEmpty()
  portfolio: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUrl()
  @IsOptional()
  resumeUrl?: string;
}

export class UpdatePersonalInfoDto extends PartialType(CreatePersonalInfoDto) {}
