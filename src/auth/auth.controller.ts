import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Req, Res } from '@nestjs/common';
import {Equals,IsString,MaxLength,MinLength} from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthGuard } from './guards/google.guard';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import type { RequestWithUser } from './interfaces/request-with-user.interface';
import { CSRF_COOKIE_NAME, RequireCsrf } from './csrf';

class SessionConfirmDto {@Equals(true) confirmed:boolean;}
class SessionLabelDto extends SessionConfirmDto {@IsString() @MinLength(1) @MaxLength(80) label:string;}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  @Get('sessions') sessions(@Req() req:RequestWithUser){return this.authService.sessions(req.user.id,req.user.sessionId);}
  @Delete('sessions') revokeOthers(@Req() req:RequestWithUser,@Body() _body:SessionConfirmDto){return this.authService.revokeOtherSessions(req.user.id,req.user.sessionId);}
  @Delete('sessions/:id') revoke(@Req() req:RequestWithUser,@Param('id') id:string,@Body() _body:SessionConfirmDto){return this.authService.manageSession(req.user.id,id);}
  @Patch('sessions/:id') rename(@Req() req:RequestWithUser,@Param('id') id:string,@Body() body:SessionLabelDto){return this.authService.manageSession(req.user.id,id,body.label);}

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleAuth(): void {
    return;
  }

  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing: unknown = req.cookies?.[CSRF_COOKIE_NAME];
    const csrfToken = typeof existing === 'string' && /^[A-Za-z0-9_-]{43}$/.test(existing)
      ? existing : this.authService.generateCsrfToken();
    res.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      this.authService.csrfCookieOptions,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    return { csrfToken };
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(@Req() req: RequestWithUser, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.generateTokens(
      req.user.id,
    );

    res.cookie(
      'Authentication',
      accessToken,
      this.authService.accessCookieOptions,
    );
    res.cookie('Refresh', refreshToken, this.authService.refreshCookieOptions);
    res.cookie(
      CSRF_COOKIE_NAME,
      this.authService.generateCsrfToken(),
      this.authService.csrfCookieOptions,
    );

    const clientUrl = this.configService.getOrThrow<string>('clientUrl');
    res.redirect(clientUrl);
  }

  @Public()
  @RequireCsrf()
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.generateTokens(
      req.user.id,
      req.user.refreshPayload,
    );

    res.cookie(
      'Authentication',
      accessToken,
      this.authService.accessCookieOptions,
    );
    res.cookie('Refresh', refreshToken, this.authService.refreshCookieOptions);

    const csrfToken = req.cookies[CSRF_COOKIE_NAME] as string;
    res.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      this.authService.csrfCookieOptions,
    );

    return { success: true, csrfToken };
  }

  @Public()
  @RequireCsrf()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.revokeSession(req.cookies as Record<string, unknown>);
    res.clearCookie('Authentication', this.authService.accessCookieOptions);
    res.clearCookie('Refresh', this.authService.refreshCookieOptions);
    res.clearCookie(CSRF_COOKIE_NAME, this.authService.csrfCookieOptions);
    return { success: true };
  }
}
