import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Company } from './Company';

@Entity('losses')
export class Loss {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'codigo_barras', length: 50 })
  codigoBarras!: string;

  @Column({ name: 'descricao_reduzida', type: 'text' })
  descricaoReduzida!: string;

  @Column({ name: 'quantidade_ajuste', type: 'decimal', precision: 10, scale: 3 })
  quantidadeAjuste!: number;

  @Column({ name: 'custo_reposicao', type: 'decimal', precision: 10, scale: 2 })
  custoReposicao!: number;

  @Column({ name: 'descricao_ajuste_completa', type: 'text' })
  descricaoAjusteCompleta!: string;

  @Column({ name: 'secao', length: 10 })
  secao!: string;

  @Column({ name: 'secao_nome', length: 100, nullable: true })
  secaoNome?: string;

  @Column({ name: 'data_importacao', type: 'date' })
  dataImportacao!: Date;

  @Column({ name: 'data_inicio_periodo', type: 'date', nullable: true })
  dataInicioPeriodo?: Date;

  @Column({ name: 'data_fim_periodo', type: 'date', nullable: true })
  dataFimPeriodo?: Date;

  @Column({ name: 'nome_lote', length: 255 })
  nomeLote!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
