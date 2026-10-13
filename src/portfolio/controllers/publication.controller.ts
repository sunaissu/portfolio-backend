import type { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';
import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import { IsObject, Equals, IsInt, Min } from 'class-validator';
import { PublicationService } from '../services/publication.service';

class VersionDto {
  @IsInt() @Min(0) version: number;
}
class SaveDto extends VersionDto {
  @IsObject() content: unknown;
}
class ConfirmDto extends VersionDto {
  @Equals(true) confirmed: boolean;
}
class RestoreDto extends ConfirmDto {
  @IsInt() @Min(0) restoreVersion: number;
}

@Controller('admin/publication')
export class PublicationController {
  constructor(private readonly service: PublicationService) {}
  @Get() get() {
    return this.service.get();
  }
  @Put() save(@Body() dto: SaveDto, @Req() request: RequestWithUser) {
    return this.service.change(
      'save',
      dto.version,
      dto.content,
      undefined,
      request.user.id,
    );
  }
  @Post('publish') publish(
    @Body() dto: ConfirmDto,
    @Req() request: RequestWithUser,
  ) {
    return this.service.change(
      'publish',
      dto.version,
      undefined,
      undefined,
      request.user.id,
    );
  }
  @Post('unpublish') unpublish(
    @Body() dto: ConfirmDto,
    @Req() request: RequestWithUser,
  ) {
    return this.service.change(
      'unpublish',
      dto.version,
      undefined,
      undefined,
      request.user.id,
    );
  }
  @Post('restore') restore(
    @Body() dto: RestoreDto,
    @Req() request: RequestWithUser,
  ) {
    return this.service.change(
      'restore',
      dto.version,
      undefined,
      dto.restoreVersion,
      request.user.id,
    );
  }
}
