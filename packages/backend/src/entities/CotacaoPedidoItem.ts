import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CotacaoPedido } from './CotacaoPedido';

@Entity('cotacao_pedido_item')
export class CotacaoPedidoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cotacao_id!: string;

  @Column({ type: 'int' })
  cod_produto!: number;

  @Column({ type: 'varchar', length: 500 })
  des_produto!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  des_unidade?: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  qtd_pedido!: number;

  @Column({ type: 'int', default: 0 })
  qtd_embalagem!: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  val_tabela!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cod_barra?: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  curva?: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  custo_ideal?: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  preco_fornecedor?: number;

  @Column({ type: 'text', nullable: true })
  observacao?: string;

  @ManyToOne(() => CotacaoPedido, cotacao => cotacao.itens)
  @JoinColumn({ name: 'cotacao_id' })
  cotacao!: CotacaoPedido;
}
