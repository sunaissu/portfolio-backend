import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthService } from './auth.service';
import { AdminUserService } from '../portfolio/services/admin-user.service';
import { AdminUserProviderService } from '../portfolio/services/admin-user-provider.service';

@Module({
  imports: [
    PortfolioModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          issuer: 'portfolio-backend',
          audience: 'portfolio-admin',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: GoogleStrategy,
      useFactory: (config: ConfigService, users: AdminUserService, providers: AdminUserProviderService) =>
        config.get<string>('auth.mode') === 'disabled' ? null : new GoogleStrategy(config, users, providers),
      inject: [ConfigService, AdminUserService, AdminUserProviderService],
    },
    JwtStrategy, JwtRefreshStrategy, AuthService,
  ],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
