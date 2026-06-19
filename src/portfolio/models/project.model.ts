import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Technology } from './technology.model';
import { ProjectLink } from './project-link.model';

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @OneToMany(() => ProjectLink, (link) => link.project, { cascade: true })
  links: ProjectLink[];

  @ManyToMany(() => Technology)
  @JoinTable()
  technologies: Technology[];

  @Column({ default: false })
  isDraft: boolean;
}
