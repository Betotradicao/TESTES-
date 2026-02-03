import { Entity, PrimaryGeneratedColumn, Column, Check, ManyToOne, JoinColumn } from 'typeorm';
import { Equipment } from './Equipment';
import { Employee } from './Employee';

export enum BipStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  CANCELLED = 'cancelled'
}

export enum MotivoCancelamento {
  PRODUTO_ABANDONADO = 'produto_abandonado',
  FALTA_CANCELAMENTO = 'falta_cancelamento',
  DEVOLUCAO_MERCADORIA = 'devolucao_mercadoria',
  ERRO_OPERADOR = 'erro_operador',
  ERRO_BALCONISTA = 'erro_balconista',
  FURTO = 'furto'
}

@Entity('bips')
@Check(`status IN ('verified', 'pending', 'cancelled')`)
export class Bip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  ean: string;

  @Column({ type: 'timestamp' })
  event_date: Date;

  @Column({ type: 'integer' })
  bip_price_cents: number;

  @Column({ type: 'varchar', length: 20 })
  product_id: string;

  @Column({ type: 'text', nullable: true })
  product_description: string | null;

  @Column({ type: 'integer', nullable: true })
  product_full_price_cents_kg: number | null;

  @Column({ type: 'integer', nullable: true })
  product_discount_price_cents_kg: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  bip_weight: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tax_cupon: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: BipStatus.PENDING,
    enum: BipStatus
  })
  status: BipStatus;

  @Column({ type: 'timestamp', nullable: true })
  notified_at: Date | null;

  @Column({ nullable: true })
  equipment_id: number;

  @ManyToOne(() => Equipment, { nullable: true })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ type: 'uuid', nullable: true })
  employee_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: MotivoCancelamento
  })
  motivo_cancelamento: MotivoCancelamento | null;

  @Column({ type: 'uuid', nullable: true })
  employee_responsavel_id: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_responsavel_id' })
  employee_responsavel: Employee | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  video_url: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;
}