import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Clipe DVR pre-gerado para um evento do PDV (Canc.Item/Cupom/Venda ou Desconto).
 *
 * Criada pelo cron Vision-Palavra-Chave a cada 2h a partir dos resultados de
 * searchOracleAllPdvs (ou searchPostgresAllPdvs). event_key garante idempotencia.
 *
 * Limpeza diaria apaga arquivo + zera registros com clip_generated_at > 2 dias.
 */
@Entity('dvr_pos_event_clips')
export class DvrPosEventClip {
  @PrimaryGeneratedColumn()
  id: number;

  // "{cod_loja}|{pdv}|{cupom_num}|{tipo}|{event_time-iso}"
  @Column({ type: 'varchar', length: 160, unique: true })
  event_key: string;

  @Column({ type: 'int' })
  @Index()
  cod_loja: number;

  @Column({ type: 'int' })
  pdv: number;

  @Column({ type: 'int' })
  cupom_num: number;

  @Column({ type: 'timestamp' })
  event_time: Date;

  // CANC.ITEM | CANC.CUPOM | CANC.VENDA | DESCONTO
  @Column({ type: 'varchar', length: 20 })
  tipo: string;

  @Column({ type: 'int' })
  channel: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  clip_status: 'ready' | 'pending_retry' | 'failed' | null;

  @Column({ type: 'int', default: 0 })
  clip_retry_count: number;

  @Column({ type: 'timestamp', nullable: true })
  clip_generated_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
