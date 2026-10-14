import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  Equals,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';
import { StudioService } from '../services/studio.service';
class RevisionDto {
  @IsInt() @Min(0) version: number;
}
class ActionDto extends RevisionDto {
  @Equals(true) confirmed: boolean;
  @IsOptional() @IsString() @MaxLength(35) locale?: string;
  @IsOptional() @IsObject() data?: unknown;
  @IsOptional() @IsInt() @Min(0) restoreVersion?: number;
  @IsOptional() @IsString() @MaxLength(40) section?: string;
  @IsOptional() @IsInt() @Min(0) index?: number;
  @IsOptional() @IsString() @MaxLength(80) id?: string;
  @IsOptional() @IsString() @MaxLength(2000) text?: string;
  @IsOptional() @IsObject() settings?: unknown;
}
class RecoveryDto extends RevisionDto {
  @IsInt() @Min(0) baseVersion: number;
  @IsObject() draft: unknown;
}
class ImportDto {
  @IsObject() data: unknown;
}
class ServiceDto extends RevisionDto {
  @IsInt() @Min(0) @Max(7) index: number;
}
class LinkDto extends RevisionDto {
  @IsInt() @Min(0) @Max(120) offset: number;
}
class PageDto {
  @IsOptional() @IsString() @MaxLength(4) page?: string;
}
@Controller('admin/studio')
export class StudioController {
  constructor(private readonly service: StudioService) {}
  @Get() get(@Req() req: RequestWithUser) {
    return this.service.get(req.user.id);
  }
  @Get('status') status(@Req() req: RequestWithUser) {
    return this.service.status(req.user.id);
  }
  @Get('audit') audit(@Req() req: RequestWithUser, @Query() query: PageDto) {
    const page =
      query.page && /^\d{1,4}$/.test(query.page) ? Number(query.page) : 0;
    return this.service.audit(req.user.id, page);
  }
  @Get('history/:version') history(
    @Req() req: RequestWithUser,
    @Param('version') version: string,
  ) {
    return this.service.revision(req.user.id, Number(version));
  }
  @Get('snapshot') snapshot(@Req() req: RequestWithUser) {
    return this.service.snapshot(req.user.id);
  }
  @Get('recovery') recovery(@Req() req: RequestWithUser) {
    return this.service.recovery(req.user.id);
  }
  @Put('recovery') saveRecovery(
    @Req() req: RequestWithUser,
    @Body() body: RecoveryDto,
  ) {
    return this.service.saveRecovery(
      req.user.id,
      body.version,
      body.baseVersion,
      body.draft,
    );
  }
  @Delete('recovery') discardRecovery(
    @Req() req: RequestWithUser,
    @Body() body: RevisionDto,
  ) {
    return this.service.discardRecovery(req.user.id, body.version);
  }
  @Post('validate') validate(
    @Req() req: RequestWithUser,
    @Body() body: ImportDto,
  ) {
    return this.service.validateImport(req.user.id, body.data);
  }
  @Post('project-status') projectStatus(
    @Req() req: RequestWithUser,
    @Body() body: ServiceDto,
  ) {
    return this.service.projectStatus(req.user.id, body.version, body.index);
  }
  @Post('links') links(@Req() req: RequestWithUser, @Body() body: LinkDto) {
    return this.service.links(req.user.id, body.version, body.offset);
  }
  @Post(':action') change(
    @Req() req: RequestWithUser,
    @Param('action') action: string,
    @Body() body: ActionDto,
  ) {
    return this.service.change(
      req.user.id,
      action,
      body.version,
      body as unknown as Record<string, unknown>,
    );
  }
}
