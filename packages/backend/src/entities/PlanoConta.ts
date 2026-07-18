import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Plano de Contas manual (modo "Direto Manual" da Conciliação).
 * Hierárquico via auto-referência: tipo='grupo' (parent_id null) -> tipo='conta' (parent_id=grupo).
 */
@Entity('plano_contas')
@Index('idx_plano_contas_loja', ['cod_loja', 'tipo', 'num_ordem'])
export class PlanoConta {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  cod_loja!: number;

  // 'grupo' | 'conta'
  @Column({ type: 'varchar', length: 10 })
  tipo!: string;

  @Column({ type: 'int', nullable: true })
  parent_id!: number | null;

  @Column({ type: 'varchar', length: 200 })
  nome!: string;

  @Column({ type: 'boolean', default: false })
  is_receita!: boolean;

  @Column({ type: 'int', default: 0 })
  num_ordem!: number;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  // Rastreiam a origem quando importado do ERP (evita duplicar no reimport)
  @Column({ type: 'int', nullable: true })
  cod_categoria_oracle!: number | null;

  @Column({ type: 'int', nullable: true })
  cod_subcategoria_oracle!: number | null;

  @CreateDateColumn()
  created_at!: Date;
}
