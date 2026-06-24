import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { AdminUserProvider } from './admin-user-provider.model';

@Entity()
export class AdminUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => AdminUserProvider, (provider) => provider.adminUser, {
    cascade: true,
  })
  providers: AdminUserProvider[];
}
