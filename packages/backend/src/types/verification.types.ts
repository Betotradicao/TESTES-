import { Bip } from '../entities/Bip';

export interface SaleData {
  codProduto: string;
  desProduto: string;
  valTotalProduto: number;
  qtdTotalProduto: number;
  dataHoraVenda?: string;
  numCupomFiscal?: number;
  /** Desconto dado no caixa (VAL_DESCONTO). Sem ele, venda com desconto nunca casava. */
  descontoAplicado?: number;
  /** Custo de reposicao unitario (VAL_CUSTO_REP) — usado pra calcular a margem. */
  valCustoRep?: number;
  codCaixa?: number;
  codOperador?: number;
  desOperador?: string;
  codLoja?: number;
}

export interface VerificationResult {
  to_verify: Array<{
    bip: Bip;
    venda: SaleData;
  }>;
  to_notify: Bip[];
}

export interface ProcessingStats {
  totalBipages: number;
  verifiedCount: number;
  notifiedCount: number;
  startTime: Date;
  endTime?: Date;
  executionTime?: string;
}