import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RuptureSurvey } from './RuptureSurvey';

@Entity('rupture_survey_items')
export class RuptureSurveyItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  survey_id: number;

  @ManyToOne(() => RuptureSurvey, survey => survey.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey: RuptureSurvey;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo_barras: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  erp_product_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  curva: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  estoque_atual: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cobertura_dias: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  grupo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  secao: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subgrupo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fornecedor: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  margem_lucro: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  qtd_embalagem: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_venda: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  custo_com_imposto: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  venda_media_dia: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  tem_pedido: string | null;

  @Column({
    type: 'enum',
    enum: ['pendente', 'encontrado', 'nao_encontrado', 'ruptura_estoque'],
    default: 'pendente'
  })
  status_verificacao: 'pendente' | 'encontrado' | 'nao_encontrado' | 'ruptura_estoque';

  @Column({ type: 'timestamp', nullable: true })
  data_verificacao: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificado_por: string | null;

  @Column({ type: 'text', nullable: true })
  observacao_item: string | null;

  @CreateDateColumn()
  created_at: Date;

  // Campos calculados
  get perda_venda_dia(): number {
    if (!this.venda_media_dia || !this.valor_venda) return 0;
    // Considerar tanto 'nao_encontrado' quanto 'ruptura_estoque' como perda
    if (this.status_verificacao !== 'nao_encontrado' && this.status_verificacao !== 'ruptura_estoque') return 0;
    return this.venda_media_dia * this.valor_venda;
  }

  get perda_lucro_dia(): number {
    if (!this.venda_media_dia || !this.valor_venda || !this.margem_lucro) return 0;
    // Considerar tanto 'nao_encontrado' quanto 'ruptura_estoque' como perda
    if (this.status_verificacao !== 'nao_encontrado' && this.status_verificacao !== 'ruptura_estoque') return 0;
    return this.venda_media_dia * this.valor_venda * (this.margem_lucro / 100);
  }

  get criticidade(): number {
    if (!this.venda_media_dia || !this.margem_lucro) return 0;
    const fatorCurva = this.curva === 'A' ? 3 : this.curva === 'B' ? 2 : 1;
    return fatorCurva * this.venda_media_dia * this.margem_lucro;
  }
}
