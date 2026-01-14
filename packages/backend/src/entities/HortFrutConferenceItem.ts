import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HortFrutConference } from './HortFrutConference';
import { HortFrutBox } from './HortFrutBox';

@Entity('hortfrut_conference_items')
export class HortFrutConferenceItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'conference_id', type: 'int' })
  conference_id!: number;

  @ManyToOne(() => HortFrutConference, conference => conference.items)
  @JoinColumn({ name: 'conference_id' })
  conference?: HortFrutConference;

  // Dados do produto (importados do CSV)
  @Column({ name: 'barcode', type: 'varchar', length: 50, nullable: true })
  barcode?: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  curve?: string;

  @Column({ name: 'section', type: 'varchar', length: 100, nullable: true })
  section?: string;

  @Column({ name: 'product_group', type: 'varchar', length: 100, nullable: true })
  productGroup?: string;

  @Column({ name: 'sub_group', type: 'varchar', length: 100, nullable: true })
  subGroup?: string;

  // Preços e margens do CSV (valores atuais no sistema)
  @Column({ name: 'current_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentCost?: number;

  @Column({ name: 'current_sale_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentSalePrice?: number;

  @Column({ name: 'reference_margin', type: 'decimal', precision: 5, scale: 2, nullable: true })
  referenceMargin?: number;

  @Column({ name: 'current_margin', type: 'decimal', precision: 5, scale: 2, nullable: true })
  currentMargin?: number;

  // Dados da conferência (informados pelo usuário)
  @Column({ name: 'new_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  newCost?: number;

  @Column({ name: 'box_id', type: 'int', nullable: true })
  box_id?: number;

  @ManyToOne(() => HortFrutBox)
  @JoinColumn({ name: 'box_id' })
  box?: HortFrutBox;

  @Column({ name: 'box_quantity', type: 'int', nullable: true })
  boxQuantity?: number;

  @Column({ name: 'gross_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  grossWeight?: number;

  @Column({ name: 'net_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  netWeight?: number;

  @Column({ name: 'expected_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  expectedWeight?: number;

  @Column({ name: 'weight_difference', type: 'decimal', precision: 10, scale: 3, nullable: true })
  weightDifference?: number;

  // Cálculos do sistema
  @Column({ name: 'suggested_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  suggestedPrice?: number;

  @Column({ name: 'margin_if_keep_price', type: 'decimal', precision: 5, scale: 2, nullable: true })
  marginIfKeepPrice?: number;

  // Qualidade e fotos
  @Column({ type: 'varchar', length: 20, nullable: true })
  quality?: string; // good, regular, bad

  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true })
  photoUrl?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  // Status do item
  @Column({ type: 'boolean', default: false })
  checked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
