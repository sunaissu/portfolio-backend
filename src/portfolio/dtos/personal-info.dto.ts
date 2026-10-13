import {
  IsString,
  Matches,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePersonalInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  @MaxLength(2048)
  linkedin: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  @MaxLength(2048)
  portfolio: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  summary: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(320)
  email: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  @MaxLength(2048)
  resumeUrl?: string;
}

export class UpdatePersonalInfoDto extends PartialType(CreatePersonalInfoDto) {
  @Matches(/^[a-f0-9]{64}$/)
  revision: string;
}
