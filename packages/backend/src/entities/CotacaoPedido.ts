import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { CotacaoPedidoItem } from './CotacaoPedidoItem';

@Entity('cotacao_pedido')
export class CotacaoPedido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  token!: string;

  @Column({ type: 'int' })
  num_pedido!: number;

  @Column({ type: 'int' })
  cod_fornecedor!: number;

  @Column({ type: 'varchar', length: 255 })
  nome_fornecedor!: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status!: string; // 'pendente' | 'respondida' | 'expirada'

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  responded_at?: Date;

  @OneToMany(() => CotacaoPedidoItem, item => item.cotacao)
  itens!: CotacaoPedidoItem[];
}
