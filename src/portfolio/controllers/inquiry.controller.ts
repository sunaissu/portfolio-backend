import type { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  Equals,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { InquiryService } from '../services/inquiry.service';
import { InquiryRateGuard } from '../services/inquiry-rate.guard';

export class ReceiptDto {
  @IsUUID('4') id: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) receipt: string;
}
export class InquiryDto extends ReceiptDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(1) @MaxLength(100) topic: string;
  @IsString() @MinLength(1) @MaxLength(4000) message: string;
  @Equals(true) consent: boolean;
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(60)
  slotId?: string;
  @IsOptional() @IsString() @MaxLength(100) timezone?: string;
}
class ChangeDto {
  @IsInt() @Min(1) version: number;
  @IsIn(['reviewed', 'confirmed', 'declined', 'closed']) status:
    | 'reviewed'
    | 'confirmed'
    | 'declined'
    | 'closed';
  @Equals(true) confirmed: boolean;
}
class DeleteDto {
  @IsInt() @Min(1) version: number;
  @Equals(true) confirmed: boolean;
}
class PageDto {
  @IsOptional() @Matches(/^\d{1,4}$/) page?: string;
}

@Controller('inquiries')
export class InquiryController {
  constructor(private readonly service: InquiryService) {}
  @Public() @Post() @UseGuards(InquiryRateGuard) submit(
    @Body() dto: InquiryDto,
  ) {
    return this.service.submit(dto);
  }
  @Public() @Post('status') @UseGuards(InquiryRateGuard) status(
    @Body() dto: ReceiptDto,
  ) {
    return this.service.status(dto);
  }
}
@Controller('admin/inquiries')
export class InquiryAdminController {
  constructor(private readonly service: InquiryService) {}
  @Get() list(@Query() query: PageDto) {
    return this.service.list(Number(query.page ?? 0));
  }
  @Patch(':id') change(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeDto,
    @Req() request: RequestWithUser,
  ) {
    return this.service.change(id, dto.version, dto.status, request.user.id);
  }
  @Delete(':id') async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DeleteDto,
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ) {
    await this.service.remove(id, dto.version, request.user.id);
    response.status(204).send();
  }
}
