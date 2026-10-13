import {
  IsString,
  IsNotEmpty,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  category: string;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {
  @IsInt()
  @Min(1)
  id: number;
}
