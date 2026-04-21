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

  // Resolucao via link publico (tokenizado)
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  resolucao_token: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  resolucao_historico: Array<{
    tipo: 'previamente' | 'definitivamente';
    mensagem: string;
    autor: string;
    timestamp: string;
  }>;

  // Origem do plano de acao: 'manual' ou 'alerta_auditoria'
  @Column({ type: 'varchar', length: 30, default: 'manual' })
  origem: 'manual' | 'alerta_auditoria';

  // Rastro do grupo WhatsApp notificado
  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_name: string | null;

  @Column({ type: 'timestamp', nullable: true })
  whatsapp_sent_at: Date | null;

  // Pergunta que originou o alerta (referencia solta para facilitar PDF/dashboard)
  @Column({ type: 'int', nullable: true })
  question_id: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
