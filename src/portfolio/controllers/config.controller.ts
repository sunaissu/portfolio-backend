import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { PortfolioDataService } from '../services/portfolio-data.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly portfolioDataService: PortfolioDataService) {}

  @Public()
  @Get()
  async getFrontendConfig(@Res({ passthrough: true }) response: Response) {
    const envelope = await this.portfolioDataService.getPortfolio();
    const cacheControl = envelope.isStale
      ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=60, stale-if-error=86400'
      : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400';
    response.setHeader('Cache-Control', cacheControl);
    response.setHeader(
      'Last-Modified',
      new Date(envelope.generatedAt).toUTCString(),
    );
    response.setHeader('Vary', 'Origin');
    response.setHeader('X-Portfolio-Source', envelope.source);
    response.setHeader('X-Portfolio-Schema-Version', envelope.schemaVersion);
    return envelope;
  }
}
