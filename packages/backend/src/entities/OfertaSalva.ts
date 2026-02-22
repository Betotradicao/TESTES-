import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ofertas_salvas')
export class OfertaSalva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cod_loja: number;

  @Column({ type: 'varchar', length: 20 })
  cod_produto: string;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cod_barras: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  secao: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  curva: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco_normal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preco_rebaixo: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preco_club: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preco_leve_mais: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo_oferta_escolhido: string | null;

  @Column({ type: 'varchar', length: 50, default: 'rascunho' })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  origem: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_oferta: string | null;

  @Column({ type: 'date', nullable: true })
  vigencia_inicio: Date | null;

  @Column({ type: 'date', nullable: true })
  vigencia_fim: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
