import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ProductActivationHistory } from './ProductActivationHistory';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  erp_product_id: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  short_description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ean: string | null;

  @Column({ type: 'boolean', default: false })
  weighable: boolean;

  @Column({ type: 'integer', nullable: true })
  section_code: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  section_name: string | null;

  @Column({ type: 'integer', nullable: true })
  group_code: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  group_name: string | null;

  @Column({ type: 'integer', nullable: true })
  subgroup_code: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subgroup_name: string | null;

  @Column({ type: 'integer', nullable: true })
  supplier_code: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier_name: string | null;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  // Campos para validação por IA
  @Column({ type: 'text', nullable: true })
  foto_referencia?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  coloracao?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  formato?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gordura_visivel?: string;

  @Column({ type: 'boolean', nullable: true })
  presenca_osso?: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  peso_min_kg?: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  peso_max_kg?: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  peso_medio_kg?: number;

  @Column({ type: 'jsonb', nullable: true })
  posicao_balcao?: {
    setor?: string;
    balcao?: number;
    posicao?: string;
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductActivationHistory, history => history.product)
  activationHistory: ProductActivationHistory[];
}