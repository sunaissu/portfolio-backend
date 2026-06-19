import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ExperienceRole } from './experience-role.model';

@Entity()
export class ExperienceResponsibility {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  description: string;

  @ManyToOne(() => ExperienceRole, (role) => role.responsibilities)
  role: ExperienceRole;
}
