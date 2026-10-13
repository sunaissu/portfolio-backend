import { Column, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('portfolio_education')
export class EducationRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  degree: string;

  @Column({ length: 200 })
  institution: string;

  @Column({ length: 40 })
  year: string;

  @Column({ default: 1 })
  version: number;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
