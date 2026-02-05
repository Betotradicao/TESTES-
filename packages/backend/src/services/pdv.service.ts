import { AppDataSource } from '../config/database';
import { Operador } from '../entities/Operador';
import { MotivoDesconto } from '../entities/MotivoDesconto';
import { Autorizador } from '../entities/Autorizador';

export interface VendaPDV {
  cupom: string;
  caixa: number;
  operador: number;
  operadorNome?: string;
  produto: string;
  descProduto: string;
  secao?: string;
  valor: number;
  quantidade: number;
  valorTotal: number;
  desconto?: number;
  motivoDesconto?: number;
  motivoDescontoDesc?: string;
  autorizadorDesconto?: number;
  autorizadorDescontoNome?: string;
  dataHora: string;
  turno: number;
  motivoCancelamento?: string;
  funcionarioCancelamento?: string;
  tipoCancelamento?: string;
}

export interface ResumoOperador {
  codigo: number;
  nome: string;
  totalVendas: number;
  valorTotalVendido: number;
  qtdDescontos: number;
  valorTotalDescontos: number;
  percentualDescontos: number;
  qtdDevolucoes: number;
  valorTotalDevolucoes: number;
  percentualDevolucoes: number;
}

export interface ResumoPDV {
  totalVendas: number;
  valorTotalVendido: number;
  qtdDescontos: number;
  valorTotalDescontos: number;
  percentualDescontos: number;
  qtdDevolucoes: number;
  valorTotalDevolucoes: number;
  percentualDevolucoes: number;
  operadores: ResumoOperador[];
}

export class PDVService {
  /**
   * @deprecated Zanthus API foi descontinuada. Use Oracle Intersolid.
   */
  static async buscarVendas(dataInicio: string, dataFim: string): Promise<VendaPDV[]> {
    throw new Error('Zanthus API foi descontinuada. O sistema agora utiliza Oracle Intersolid.');
  }

  /**
   * @deprecated Zanthus API foi descontinuada. Use Oracle Intersolid.
   */
  static async gerarResumo(dataInicio: string, dataFim: string): Promise<ResumoPDV> {
    throw new Error('Zanthus API foi descontinuada. O sistema agora utiliza Oracle Intersolid.');
  }
}
