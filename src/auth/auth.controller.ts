import { Controller, Get, Post, UseGuards, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthGuard } from './guards/google.guard';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { Public } from './decorators/public.decorator';
import type { RequestWithUser } from './interfaces/request-with-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {}

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

    const clientUrl = this.configService.getOrThrow<string>('clientUrl');
    res.redirect(clientUrl);
  }

  @Public()
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.generateTokens(
      req.user.id,
    );

    res.cookie(
      'Authentication',
      accessToken,
      this.authService.accessCookieOptions,
    );
    res.cookie('Refresh', refreshToken, this.authService.refreshCookieOptions);

    return { success: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('Authentication', this.authService.accessCookieOptions);
    res.clearCookie('Refresh', this.authService.refreshCookieOptions);
    return { success: true };
  }
}
