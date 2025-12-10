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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductActivationHistory, history => history.product)
  activationHistory: ProductActivationHistory[];
}