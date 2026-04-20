import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AuditTemplate } from './AuditTemplate';
import { Employee } from './Employee';

export type AuditInspectionStatus = 'rascunho' | 'enviada' | 'aprovada' | 'rejeitada';

@Entity('audit_inspections')
export class AuditInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  template_id: number;

  @ManyToOne(() => AuditTemplate)
  @JoinColumn({ name: 'template_id' })
  template: AuditTemplate;

  @Column({ name: 'auditor_id', type: 'uuid' })
  auditor_id: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'auditor_id' })
  auditor: Employee;

  @Column({ name: 'auditado_id', type: 'uuid', nullable: true })
  auditado_id: string | null;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'auditado_id' })
  auditado: Employee | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ type: 'varchar', length: 20, default: 'rascunho' })
  status: AuditInspectionStatus;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gps_inicio_lat: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gps_inicio_lng: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  score_final: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  score_max: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percentual_conformidade: number | null;

  @Column({ type: 'text', nullable: true })
  observacao_geral: string | null;

  @Column({ type: 'text', nullable: true })
  assinatura_auditor_url: string | null;

  @Column({ type: 'text', nullable: true })
  assinatura_auditado_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
