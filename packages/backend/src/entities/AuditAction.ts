import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AuditInspection } from './AuditInspection';
import { AuditResponse } from './AuditResponse';
import { Employee } from './Employee';

export type AuditActionStatus = 'aberta' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';

@Entity('audit_actions')
export class AuditAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inspection_id' })
  inspection_id: number;

  @ManyToOne(() => AuditInspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: AuditInspection;

  @Column({ name: 'response_id', nullable: true })
  response_id: number | null;

  @ManyToOne(() => AuditResponse, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'response_id' })
  response: AuditResponse | null;

  @Column({ type: 'text' })
  what: string;

  @Column({ type: 'text', nullable: true })
  why: string | null;

  @Column({ name: 'who_employee_id', type: 'uuid', nullable: true })
  who_employee_id: string | null;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'who_employee_id' })
  who: Employee | null;

  @Column({ type: 'timestamp', nullable: true })
  when_prazo: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  where_setor: string | null;

  @Column({ type: 'text', nullable: true })
  how: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  how_much: number | null;

  @Column({ type: 'varchar', length: 10, default: 'media' })
  criticidade: 'baixa' | 'media' | 'alta';

  @Column({ type: 'varchar', length: 20, default: 'aberta' })
  status: AuditActionStatus;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ type: 'timestamp', nullable: true })
  concluido_em: Date | null;

  @Column({ name: 'concluido_por', type: 'uuid', nullable: true })
  concluido_por: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
