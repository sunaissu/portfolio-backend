import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { ProjectLink } from './project-link.model';
import { Technology } from './technology.model';

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

  @ManyToMany(() => Technology, { cascade: true })
  @JoinTable()
  technologies: Technology[];

  @Column({ nullable: true })
  status: string;

  @Column({ default: false })
  isDraft: boolean;

  @Column({ default: false })
  isFeatured: boolean;
}
