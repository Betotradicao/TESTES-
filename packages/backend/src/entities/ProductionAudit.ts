import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { ProductionAuditItem } from './ProductionAuditItem';

@Entity('production_audits')
export class ProductionAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  audit_date: Date;

  @Column({ type: 'integer' })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, default: 'in_progress' })
  status: string; // in_progress, completed

  @Column({ type: 'text', nullable: true })
  pdf_url: string | null;

  @Column({ type: 'boolean', default: false })
  sent_whatsapp: boolean;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductionAuditItem, item => item.audit)
  items: ProductionAuditItem[];
}
