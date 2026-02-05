import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './Product';
import { Bip } from './Bip';

@Entity('sells')
export class Sell {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'activated_product_id' })
  activatedProductId: number;

  @Column({ name: 'product_id', length: 20 })
  productId: string;

  @Column({ name: 'product_description', type: 'text' })
  productDescription: string;

  @Column({ name: 'sell_date', type: 'timestamp' })
  sellDate: Date;

  @Column({ name: 'sell_value_cents', type: 'integer' })
  sellValueCents: number;

  @Column({ name: 'product_weight', type: 'decimal', precision: 12, scale: 3 })
  productWeight: number;

  @Column({ name: 'bip_id', nullable: true })
  bipId: number | null;

  @Column({ name: 'num_cupom_fiscal', type: 'integer', nullable: true })
  numCupomFiscal: number | null;

  @Column({ name: 'point_of_sale_code', type: 'integer', nullable: true })
  pointOfSaleCode: number | null;

  @Column({ name: 'operator_code', type: 'integer', nullable: true })
  operatorCode: number | null;

  @Column({ name: 'operator_name', type: 'varchar', length: 100, nullable: true })
  operatorName: string | null;

  @Column({ name: 'discount_cents', type: 'integer', default: 0 })
  discountCents: number;

  @Column({ length: 20 })
  status: 'verified' | 'not_verified' | 'cancelled';

  @Column({ name: 'cod_loja', type: 'int', nullable: true })
  codLoja: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'activated_product_id' })
  activatedProduct: Product;

  @ManyToOne(() => Bip, { nullable: true })
  @JoinColumn({ name: 'bip_id' })
  bip: Bip | null;

  // Virtual properties for API response
  get sellValue(): number {
    return this.sellValueCents / 100;
  }

  get discountValue(): number {
    return this.discountCents / 100;
  }

  get finalValue(): number {
    return (this.sellValueCents - this.discountCents) / 100;
  }

  get statusDescription(): string {
    switch (this.status) {
      case 'verified':
        return 'Venda verificada - bipagem encontrada';
      case 'not_verified':
        return 'Venda não verificada - possível furto';
      case 'cancelled':
        return 'Venda cancelada';
      default:
        return 'Venda não verificada - possível furto';
    }
  }
}