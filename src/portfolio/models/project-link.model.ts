import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Project } from './project.model';

@Entity()
export class ProjectLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column({ default: 'github' })
  type: string;

  @ManyToOne(() => Project, (project) => project.links)
  project: Project;
}
