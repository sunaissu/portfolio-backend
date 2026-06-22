import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { AdminUser } from './admin-user.model';

@Entity()
@Unique(['provider', 'providerId'])
export class AdminUserProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  provider: string;

  @Column()
  providerId: string;

  @ManyToOne(() => AdminUser, (adminUser) => adminUser.providers)
  adminUser: AdminUser;
}
