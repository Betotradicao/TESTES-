import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Classificação por movimento específico do extrato (Conciliação Manual).
 * tipo 'unica' (plano_conta_id) | 'transferencia' (transfer_id). Vence a amarração por texto.
 */
@Entity('conciliacao_movimento')
@Index('uq_conc_mov_loja_key', ['cod_loja', 'mov_key'], { unique: true })
export class ConciliacaoMovimento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  cod_loja!: number;

  @Column({ type: 'text' })
  mov_key!: string;

  // 'unica' | 'transferencia'
  @Column({ type: 'varchar', length: 20 })
  tipo!: string;

  @Column({ type: 'int', nullable: true })
  plano_conta_id!: number | null;

  @Column({ type: 'uuid', nullable: true })
  transfer_id!: string | null;

  // Para tipo 'fatura': lista de lançamentos [{ plano_conta_id, valor }]
  @Column({ type: 'jsonb', nullable: true })
  itens!: { plano_conta_id: number; valor: number }[] | null;

  @CreateDateColumn()
  created_at!: Date;
}
