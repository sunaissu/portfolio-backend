import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PortfolioDataService } from '../../portfolio/services/portfolio-data.service';
import { DatabaseConnectionService } from '../services/database-connection.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly portfolioDataService: PortfolioDataService,
    private readonly databaseConnectionService: DatabaseConnectionService,
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
      portfolio,
    };
  }
}
