import { IsString, IsNotEmpty } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSkillItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateSkillItemDto extends PartialType(CreateSkillItemDto) {}
