import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Experience } from './experience.model';
import { ExperienceResponsibility } from './experience-responsibility.model';

@Entity()
export class ExperienceRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  duration: string;

  @OneToMany(() => ExperienceResponsibility, (resp) => resp.role, {
    cascade: true,
  })
  responsibilities: ExperienceResponsibility[];

  @ManyToOne(() => Experience, (experience) => experience.roles)
  experience: Experience;
}
