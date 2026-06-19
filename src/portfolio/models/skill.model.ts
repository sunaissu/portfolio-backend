import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { SkillItem } from './skill-item.model';

@Entity()
export class Skill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  domain: string;

  @OneToMany(() => SkillItem, (item) => item.skill, { cascade: true })
  items: SkillItem[];
}
