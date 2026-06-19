import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ExperienceRole } from './experience-role.model';

@Entity()
export class Experience {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  company: string;

  @Column('text')
  description: string;

  @OneToMany(() => ExperienceRole, (role) => role.experience, { cascade: true })
  roles: ExperienceRole[];
}
