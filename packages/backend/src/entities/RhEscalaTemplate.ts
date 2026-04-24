import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_escala_templates')
export class RhEscalaTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ name: 'tipo_rotacao', length: 30, default: '6x1' })
  tipoRotacao: string;

  @Column({ name: 'folga_preferida', type: 'varchar', length: 30, nullable: true })
  folgaPreferida: string | null;

  @Column({ name: 'trabalha_feriado', default: true })
  trabalhaFeriado: boolean;

  // padrao_semanal: array de semanas, cada semana = array de 7 turnoIds (dom..sab) ou null
  // ex: [ [null, "uuidTM", "uuidTM", "uuidFG", "uuidTM", "uuidTM", "uuidTM"], [... sem2] ]
  @Column({ name: 'padrao_semanal', type: 'jsonb', default: () => "'[]'" })
  padraoSemanal: (string | null)[][];

  @Column({ name: 'vigencia_inicio', type: 'date', nullable: true })
  vigenciaInicio: string | null;

  @Column({ name: 'vigencia_fim', type: 'date', nullable: true })
  vigenciaFim: string | null;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
