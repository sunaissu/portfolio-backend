import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PortfolioContent } from '../types/portfolio-content';

@Entity('portfolio_publication')
export class Publication {
  @PrimaryColumn('int') id: number;
  @Column('int', { default: 1 }) version: number;
  @Column('jsonb') draft: PortfolioContent;
  @Column('jsonb', { nullable: true }) published: PortfolioContent | null;
  @Column('timestamptz', { nullable: true }) publishedAt: Date | null;
  @Column('jsonb', { default: [] }) history: Array<{
    version: number;
    savedAt: string;
    content: PortfolioContent;
  }>;
}
