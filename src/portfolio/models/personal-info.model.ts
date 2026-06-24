import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class PersonalInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  location: string;

  @Column()
  linkedin: string;

  @Column()
  portfolio: string;

  @Column('text')
  summary: string;

  @Column()
  title: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  resumeUrl: string;
}
