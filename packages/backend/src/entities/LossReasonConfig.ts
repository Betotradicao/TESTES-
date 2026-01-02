import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Company } from './Company';

@Entity('loss_reason_configs')
export class LossReasonConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'motivo', type: 'text' })
  motivo!: string;

  @Column({ name: 'ignorar_calculo', type: 'boolean', default: false })
  ignorarCalculo!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
