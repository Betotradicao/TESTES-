import { Bip } from '../entities/Bip';

export interface SaleData {
  codProduto: string;
  desProduto: string;
  valTotalProduto: number;
  qtdTotalProduto: number;
  dataHoraVenda?: string;
  numCupomFiscal?: number;
  descontoAplicado?: number;
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