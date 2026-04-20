import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface AlternativaItem {
  ordem: number;
  icone: string;        // smile_green | frown_red | na_blue | warning_yellow | ...
  label: string;
  valor: number;        // peso/score da alternativa
  cor?: string;         // opcional — cor associada (hex)
}

@Entity('audit_alternative_models')
export class AuditAlternativeModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 30, default: 'icones' })
  tipo: 'icones' | 'texto' | 'numero';

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  alternativas: AlternativaItem[];

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
