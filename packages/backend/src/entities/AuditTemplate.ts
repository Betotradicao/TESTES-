import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AuditTemplateSection } from './AuditTemplateSection';

@Entity('audit_templates')
export class AuditTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'int', default: 24 })
  prazo_alta_horas: number;

  @Column({ type: 'int', default: 7 })
  prazo_media_dias: number;

  @Column({ type: 'int', default: 30 })
  prazo_baixa_dias: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 95 })
  minimo_esperado: number;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  grupos_acesso: string[]; // array de employee IDs (uuid) com permissao de aplicar (auditores)

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  grupos_acesso_auditados: string[]; // array de employee IDs (uuid) liberados pra serem auditados

  // Grupo WhatsApp para envio automatico do PDF quando uma auditoria deste template for finalizada
  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_pdf_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_pdf_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => AuditTemplateSection, s => s.template)
  sections: AuditTemplateSection[];
}
