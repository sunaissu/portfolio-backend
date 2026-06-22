import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminUserService } from 'src/portfolio/services/admin-user.service';
import { AdminUserProviderService } from 'src/portfolio/services/admin-user-provider.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private adminUserService: AdminUserService,
    private adminUserProviderService: AdminUserProviderService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('google.clientId'),
      clientSecret: configService.getOrThrow<string>('google.clientSecret'),
      callbackURL: configService.getOrThrow<string>('google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const { id, emails } = profile;
    const email = emails[0]?.value;

    if (!email) {
      throw new UnauthorizedException('Unauthorized. No email.');
    }

    const userProviderLink =
      await this.adminUserProviderService.findByProviderId('google', id);
    if (userProviderLink) {
      if (!userProviderLink.adminUser.isActive) {
        throw new UnauthorizedException('Account is deactivated.');
      }
      return userProviderLink.adminUser;
    }

    const user = await this.adminUserService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Unauthorized. Email not in whitelist.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    await this.adminUserProviderService.addOrUpdate({
      provider: 'google',
      providerId: id,
      adminUser: user,
    });

    return user;
  }
}
