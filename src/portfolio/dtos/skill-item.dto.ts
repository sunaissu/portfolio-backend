import {
  IsString,
  IsNotEmpty,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSkillItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  skillId: number;
}

export class UpdateSkillItemDto extends PartialType(CreateSkillItemDto) {
  @IsInt()
  @Min(1)
  id: number;
}
