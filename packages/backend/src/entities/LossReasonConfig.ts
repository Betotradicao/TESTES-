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
<<<<<<< HEAD
  companyId?: string | null;

  @ManyToOne(() => Company, { nullable: true })
=======
  companyId?: string;

  @ManyToOne(() => Company)
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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
