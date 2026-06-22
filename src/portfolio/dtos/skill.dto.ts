import { IsString, IsNotEmpty } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  category: string;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}
