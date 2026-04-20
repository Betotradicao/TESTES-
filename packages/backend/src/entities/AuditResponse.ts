import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AuditInspection } from './AuditInspection';
import { AuditTemplateQuestion } from './AuditTemplateQuestion';

export type AuditConforme = 'C' | 'NC' | 'NA';

@Entity('audit_responses')
export class AuditResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inspection_id' })
  inspection_id: number;

  @ManyToOne(() => AuditInspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: AuditInspection;

  @Column({ name: 'question_id' })
  question_id: number;

  @ManyToOne(() => AuditTemplateQuestion)
  @JoinColumn({ name: 'question_id' })
  question: AuditTemplateQuestion;

  @Column({ type: 'varchar', length: 3, nullable: true })
  conforme: AuditConforme | null;

  @Column({ type: 'text', nullable: true })
  valor_texto: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  valor_numero: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  valor_opcao: string | null;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  fotos: Array<{ url: string; hash?: string; gps_lat?: number; gps_lng?: number; captured_at?: string }>;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gps_lat: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gps_lng: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  score_obtido: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
