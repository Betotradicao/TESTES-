import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AuditTemplateSection } from './AuditTemplateSection';

export type AuditQuestionTipo = 'conforme' | 'sim_nao' | 'escala' | 'multipla' | 'numero' | 'texto' | 'foto' | 'assinatura' | 'codigo_barras';
export type AuditCriticidade = 'baixa' | 'media' | 'alta';

@Entity('audit_template_questions')
export class AuditTemplateQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'section_id' })
  section_id: number;

  @ManyToOne(() => AuditTemplateSection, s => s.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: AuditTemplateSection;

  @Column({ type: 'text' })
  texto: string;

  @Column({ type: 'varchar', length: 30, default: 'conforme' })
  tipo: AuditQuestionTipo;

  @Column({ type: 'varchar', length: 10, default: 'media' })
  criticidade: AuditCriticidade;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 1 })
  peso: number;

  @Column({ type: 'boolean', default: false })
  foto_obrigatoria: boolean;

  @Column({ type: 'jsonb', nullable: true })
  opcoes: any;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ type: 'int', nullable: true })
  modelo_alternativa_id: number | null;

  // Customizacao por alternativa: flags de foto/comentario/alerta e valor override
  // Ex: [{ ordem:1, requires_photo:false, requires_comment:false, generates_alert:false, valor_override:null },
  //      { ordem:2, requires_photo:true,  requires_comment:true,  generates_alert:true,  valor_override:-2 }, ...]
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  alternativas_config: Array<{
    ordem: number;
    requires_photo?: boolean;
    requires_comment?: boolean;
    generates_alert?: boolean;
    mostrar_relatorio?: boolean;
    valor_override?: number | null;
    com_lista?: boolean;
  }>;

  // Imagens de referencia que o auditor consulta (ex: foto do padrao correto)
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  imagens_referencia: Array<{ url: string; titulo?: string }>;

  // Horario permitido para preenchimento (formato HH:MM). Apos hora_fim, auto-preenche como "nao feito".
  @Column({ type: 'varchar', length: 5, nullable: true })
  hora_inicio: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  hora_fim: string | null;

  // Regras de agendamento (quando a pergunta aparece). Se TODAS vazias/false = aparece sempre.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  dias_semana: number[]; // 0=Dom, 1=Seg, ..., 6=Sab

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  dias_mes_especificos: number[]; // 1-31

  @Column({ type: 'boolean', default: false })
  primeiro_dia_mes: boolean;

  @Column({ type: 'boolean', default: false })
  ultimo_dia_mes: boolean;

  @CreateDateColumn()
  created_at: Date;
}
