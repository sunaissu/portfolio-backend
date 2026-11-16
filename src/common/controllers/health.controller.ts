import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../auth/decorators/public.decorator';
import { PortfolioDataService } from '../../portfolio/services/portfolio-data.service';
import { DatabaseConnectionService } from '../services/database-connection.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly portfolioDataService: PortfolioDataService,
    private readonly databaseConnectionService: DatabaseConnectionService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' as const };
  }

  @Public()
  @Get('ready')
  ready() {
    const portfolio = this.portfolioDataService.getHealth();
    const database = this.databaseConnectionService.getStatus();
    return {
      status:
        database.connected && portfolio.lastDatabaseFailure === null && portfolio.cacheAgeSeconds !== null
          ? ('ready' as const)
          : ('degraded' as const),
      database,
      administration: {
        enabled: this.configService.get<string>('auth.mode') !== 'disabled',
      },
      portfolio,
    };
  }
}
