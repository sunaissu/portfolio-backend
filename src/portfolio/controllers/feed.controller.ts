import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { PortfolioDataService } from '../services/portfolio-data.service';
import { portfolioFeed } from '../services/feed';

@Controller('feed')
export class FeedController {
  constructor(private readonly data: PortfolioDataService) {}
  @Public() @Get() async get(@Res() response: Response) {
    const envelope = await this.data.getPortfolio();
    response.setHeader('Cache-Control', 'public, max-age=60');
    response.setHeader('X-Portfolio-Source', envelope.source);
    response
      .type('application/atom+xml')
      .send(portfolioFeed(envelope.data, envelope.generatedAt));
  }
}
