import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEducationDto {
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  degree: string;

  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution: string;

  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  year: string;
}

export class UpdateEducationDto extends CreateEducationDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version: number;
}

export class DeleteEducationDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version: number;
}
