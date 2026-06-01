import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export interface PedidoSugeridoItem {
  ean: string | null;
  codigo: string | null;
  descricao: string;
  dtaUltCompra?: string | null;
  estoqueAtual?: number | null;
  estoqueTroca?: number | null;
  cobertura?: number | null;
  curva?: string | null;
  qtdEstoqueInformada: number | null;
  qtdSugerida: number;
}

/**
 * Pedido sugerido enviado por fornecedor via link publico.
 * Status: pendente -> aprovado/rejeitado.
 */
@Entity('fornecedor_pedidos_sugeridos')
export class FornecedorPedidoSugerido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  cod_fornecedor: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_fornecedor: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cnpj_fornecedor: string | null;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: 'pendente' | 'aprovado' | 'rejeitado';

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  itens: PedidoSugeridoItem[];

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_origem: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  enviado_em: Date;

  @Column({ type: 'timestamp', nullable: true })
  atualizado_em: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  atualizado_por: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
