import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('nota_fiscal_recebimento')
export class NotaFiscalRecebimento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  num_nota: string;

  @Column({ type: 'varchar', length: 255 })
  fornecedor: string;

  @Column({ type: 'int', nullable: true })
  cod_fornecedor: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razao_social: string | null;

  @Column({ type: 'date' })
  data_recebimento: Date;

  @Column({ type: 'varchar', length: 10 })
  hora_recebimento: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  valor_nota: number;

  @Column({ type: 'uuid', nullable: true })
  conferente_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  conferente_nome: string | null;

  @Column({ type: 'timestamp', nullable: true })
  conferente_assinado_em: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cpd_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cpd_nome: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cpd_assinado_em: Date | null;

  @Column({ type: 'uuid', nullable: true })
  financeiro_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  financeiro_nome: string | null;

  @Column({ type: 'timestamp', nullable: true })
  financeiro_assinado_em: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
