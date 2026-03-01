import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BankAccount } from './BankAccount';

@Entity('bank_transfers')
export class BankTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_account_id', type: 'uuid' })
  source_account_id!: string;

  @Column({ name: 'target_account_id', type: 'uuid' })
  target_account_id!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string;

  @ManyToOne(() => BankAccount)
  @JoinColumn({ name: 'source_account_id' })
  sourceAccount!: BankAccount;

  @ManyToOne(() => BankAccount)
  @JoinColumn({ name: 'target_account_id' })
  targetAccount!: BankAccount;

  @CreateDateColumn()
  created_at!: Date;
}
