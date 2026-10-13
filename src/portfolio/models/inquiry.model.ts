import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('portfolio_inquiry')
export class Inquiry {
  @PrimaryColumn('uuid') id: string;
  @Column('varchar', { length: 64, select: false }) receiptHash: string;
  @Column('varchar', { length: 64, select: false }) requestHash: string;
  @Column('varchar', { length: 100 }) name: string;
  @Column('varchar', { length: 254 }) email: string;
  @Column('varchar', { length: 100 }) topic: string;
  @Column('text') message: string;
  @Column('jsonb', { nullable: true }) slot: {
    id: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
  } | null;
  @Column('varchar', { length: 20, default: 'received' }) status:
    | 'received'
    | 'reviewed'
    | 'confirmed'
    | 'declined'
    | 'closed';
  @Column('int', { default: 1 }) version: number;
  @Column('timestamptz') createdAt: Date;
  @Index() @Column('timestamptz') expiresAt: Date;
}
