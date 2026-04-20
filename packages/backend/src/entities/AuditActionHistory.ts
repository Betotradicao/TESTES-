import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AuditAction } from './AuditAction';

@Entity('audit_action_history')
export class AuditActionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'action_id' })
  action_id: number;

  @ManyToOne(() => AuditAction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'action_id' })
  action: AuditAction;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status_anterior: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status_novo: string | null;

  @Column({ name: 'alterado_por', type: 'uuid', nullable: true })
  alterado_por: string | null;

  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  @CreateDateColumn()
  created_at: Date;
}
