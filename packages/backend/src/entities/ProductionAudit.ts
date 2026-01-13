import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { Employee } from './Employee';
import { ProductionAuditItem } from './ProductionAuditItem';

@Entity('production_audits')
export class ProductionAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  audit_date: Date;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'varchar', length: 20, default: 'in_progress' })
  status: string; // in_progress, completed

  @Column({ type: 'text', nullable: true })
  pdf_url: string | null;

  @Column({ type: 'boolean', default: false })
  sent_whatsapp: boolean;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductionAuditItem, item => item.audit)
  items: ProductionAuditItem[];
}
