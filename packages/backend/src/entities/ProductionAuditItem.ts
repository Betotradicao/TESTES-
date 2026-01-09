import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionAudit } from './ProductionAudit';

@Entity('production_audit_items')
export class ProductionAuditItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  audit_id: number;

  @ManyToOne(() => ProductionAudit, audit => audit.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: ProductionAudit;

  @Column({ type: 'varchar', length: 20 })
  product_code: string; // Código ERP do produto

  @Column({ type: 'varchar', length: 255 })
  product_name: string;

  @Column({ type: 'integer' })
  quantity_units: number; // Quantidade contada em unidades

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  unit_weight_kg: number | null; // Peso médio por unidade usado no cálculo

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity_kg: number; // Calculado: units × unit_weight

  @Column({ type: 'integer' })
  production_days: number; // Quantos dias vai produzir ESTE produto especificamente

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  avg_sales_kg: number | null; // Média de venda diária (em kg)

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  suggested_production_kg: number | null; // Sugestão calculada

  @Column({ type: 'integer', nullable: true })
  suggested_production_units: number | null; // Sugestão em unidades

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unit_cost: number | null; // Custo unitário

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unit_price: number | null; // Preço de venda unitário

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  profit_margin: number | null; // Margem de lucro em %

  @CreateDateColumn()
  created_at: Date;
}
