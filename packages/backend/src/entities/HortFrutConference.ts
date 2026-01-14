import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Company } from './Company';
import { User } from './User';
import { HortFrutConferenceItem } from './HortFrutConferenceItem';

@Entity('hortfrut_conferences')
export class HortFrutConference {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  company_id!: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'conference_date', type: 'date' })
  conferenceDate!: Date;

  @Column({ name: 'supplier_name', type: 'varchar', length: 255, nullable: true })
  supplierName?: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 100, nullable: true })
  invoiceNumber?: string;

  @Column({ name: 'total_expected_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  totalExpectedWeight?: number;

  @Column({ name: 'total_actual_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  totalActualWeight?: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalCost?: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string; // pending, in_progress, completed

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @OneToMany(() => HortFrutConferenceItem, item => item.conference)
  items?: HortFrutConferenceItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
