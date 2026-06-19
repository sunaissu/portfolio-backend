import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Skill } from './skill.model';

@Entity()
export class SkillItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Skill, (skill) => skill.items)
  skill: Skill;
}
