import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LabelAudit } from './LabelAudit';

@Entity('label_audit_items')
export class LabelAuditItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  audit_id: number;

  @ManyToOne(() => LabelAudit, audit => audit.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: LabelAudit;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigo_barras: string | null;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  etiqueta: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  secao: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_venda: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_oferta: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  margem_pratica: string | null;

  @Column({
    type: 'enum',
    enum: ['pendente', 'preco_correto', 'preco_divergente'],
    default: 'pendente'
  })
  status_verificacao: 'pendente' | 'preco_correto' | 'preco_divergente';

  @Column({ type: 'timestamp', nullable: true })
  data_verificacao: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificado_por: string | null;

  @Column({ type: 'text', nullable: true })
  observacao_item: string | null;

  @CreateDateColumn()
  created_at: Date;
}
