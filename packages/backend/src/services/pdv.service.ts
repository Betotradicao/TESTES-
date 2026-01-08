import axios from 'axios';
import { ConfigurationService } from './configuration.service';
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
  private static formatDateForSQL(date: string): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static async buscarVendas(dataInicio: string, dataFim: string): Promise<VendaPDV[]> {
    const apiUrl = await ConfigurationService.get('zanthus_api_url', null);
    const port = await ConfigurationService.get('zanthus_port', null);
    const endpoint = await ConfigurationService.get(
      'zanthus_sales_endpoint',
      '/manager/restful/integracao/cadastro_sincrono.php5'
    );

    const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
    const zanthusApiUrl = baseUrl ? `${baseUrl}${endpoint}` : process.env.API_ZANTHUS_URL;

    if (!zanthusApiUrl) {
      throw new Error('Zanthus API URL not configured');
    }

    const formattedFromDate = this.formatDateForSQL(dataInicio);
    const formattedToDate = this.formatDateForSQL(dataFim);

    // SQL com todos os campos necessários para análise de PDV
    const sql = `
      SELECT
        z.M00AD as cupom,
        z.M00AC as caixa,
        z.M43CZ as operador,
        z.M43AH as produto,
        p.DESCRICAO_PRODUTO as descProduto,
        z.M43DQ as valor,
        z.M43AO as quantidade,
        z.M43AP as valorTotal,
        z.M43AQ as desconto,
        z.M43DF as motivoDesconto,
        z.M43DG as autorizadorDesconto,
        TO_CHAR(TO_TIMESTAMP(TO_CHAR(z.M00AF,'YYYY-MM-DD') || ' ' || LPAD(z.M43AS,4,'0'), 'YYYY-MM-DD HH24MI'), 'YYYY-MM-DD HH24:MI:SS') AS dataHora,
        z.M00_TURNO as turno,
        z.M43BV as motivoCancelamento,
        z.M43BW as funcionarioCancelamento,
        z.M43CF as tipoCancelamento
      FROM ZAN_M43 z
      LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
      WHERE TRUNC(z.M00AF) BETWEEN TO_DATE('${formattedFromDate}','YYYY-MM-DD') AND TO_DATE('${formattedToDate}','YYYY-MM-DD')
    `.replace(/\s+/g, ' ').trim();

    const jsonData = {
      ZMI: {
        DATABASES: {
          DATABASE: {
            '@attributes': {
              NAME: 'MANAGER',
              AUTOCOMMIT_VALUE: '1000',
              AUTOCOMMIT_ENABLED: '1',
              HALTONERROR: '1'
            },
            COMMANDS: {
              SELECT: {
                MERCADORIAS: {
                  MERCADORIA: {
                    SQL: sql
                  }
                }
              }
            }
          }
        }
      }
    };

    const formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(jsonData));

    const response = await axios.post(zanthusApiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 120000
    });

    const vendas = response.data?.QUERY?.CONTENT || [];

    // Buscar mapeamentos do banco usando TypeORM
    const operadorRepo = AppDataSource.getRepository(Operador);
    const motivoRepo = AppDataSource.getRepository(MotivoDesconto);
    const autorizadorRepo = AppDataSource.getRepository(Autorizador);

    const operadores = await operadorRepo.find({ where: { ativo: true } });
    const motivos = await motivoRepo.find({ where: { ativo: true } });
    const autorizadores = await autorizadorRepo.find({ where: { ativo: true } });

    // Criar maps para lookup rápido
    const operadorMap = new Map(operadores.map(o => [o.codigo, o.nome]));
    const motivoMap = new Map(motivos.map(m => [m.codigo, m.descricao]));
    const autorizadorMap = new Map(autorizadores.map(a => [a.codigo, a.nome]));

    // Enriquecer vendas com nomes
    return vendas.map((v: any) => ({
      cupom: v.CUPOM,
      caixa: parseInt(v.CAIXA),
      operador: parseInt(v.OPERADOR),
      operadorNome: operadorMap.get(parseInt(v.OPERADOR)) || `Operador ${v.OPERADOR}`,
      produto: v.PRODUTO,
      descProduto: v.DESCPRODUTO || v.PRODUTO,
      valor: parseFloat(v.VALOR || 0),
      quantidade: parseFloat(v.QUANTIDADE || 0),
      valorTotal: parseFloat(v.VALORTOTAL || 0),
      desconto: v.DESCONTO ? parseFloat(v.DESCONTO) : undefined,
      motivoDesconto: v.MOTIVODESCONTO ? parseInt(v.MOTIVODESCONTO) : undefined,
      motivoDescontoDesc: v.MOTIVODESCONTO ? motivoMap.get(parseInt(v.MOTIVODESCONTO)) : undefined,
      autorizadorDesconto: v.AUTORIZADORDESCONTO ? parseInt(v.AUTORIZADORDESCONTO) : undefined,
      autorizadorDescontoNome: v.AUTORIZADORDESCONTO
        ? autorizadorMap.get(parseInt(v.AUTORIZADORDESCONTO))
        : undefined,
      dataHora: v.DATAHORA,
      turno: parseInt(v.TURNO || 1),
      motivoCancelamento: v.MOTIVOCANCELAMENTO,
      funcionarioCancelamento: v.FUNCIONARIOCANCELAMENTO,
      tipoCancelamento: v.TIPOCANCELAMENTO
    }));
  }

  static async gerarResumo(dataInicio: string, dataFim: string): Promise<ResumoPDV> {
    const vendas = await this.buscarVendas(dataInicio, dataFim);

    // Filter out cancelled transactions and negative quantities
    // Note: Zanthus returns "0" for non-cancelled transactions, not null or empty
    const vendasValidas = vendas.filter(v =>
      v.quantidade > 0 &&
      (!v.tipoCancelamento || v.tipoCancelamento === '0') &&
      (!v.motivoCancelamento || v.motivoCancelamento === '0')
    );

    // Calcular totais gerais
    const totalVendas = vendasValidas.length;
    const valorTotalVendido = vendasValidas.reduce((sum, v) => sum + v.valorTotal, 0);

    const vendasComDesconto = vendasValidas.filter(v => v.desconto && v.desconto > 0);
    const qtdDescontos = vendasComDesconto.length;
    const valorTotalDescontos = vendasComDesconto.reduce((sum, v) => sum + (v.desconto || 0), 0);
    const percentualDescontos = totalVendas > 0 ? (qtdDescontos / totalVendas) * 100 : 0;

    const devolucoes = vendas.filter(v =>
      v.quantidade < 0 &&
      (!v.tipoCancelamento || v.tipoCancelamento === '0') &&
      (!v.motivoCancelamento || v.motivoCancelamento === '0')
    );
    const qtdDevolucoes = devolucoes.length;
    const valorTotalDevolucoes = Math.abs(devolucoes.reduce((sum, v) => sum + v.valorTotal, 0));
    const percentualDevolucoes = totalVendas > 0 ? (qtdDevolucoes / totalVendas) * 100 : 0;

    // Agrupar por operador
    const operadoresMap = new Map<number, any>();

    vendas.forEach(v => {
      // Skip cancelled transactions completely
      // Note: Zanthus returns "0" for non-cancelled transactions
      if ((v.tipoCancelamento && v.tipoCancelamento !== '0') ||
          (v.motivoCancelamento && v.motivoCancelamento !== '0')) {
        return;
      }

      if (!operadoresMap.has(v.operador)) {
        operadoresMap.set(v.operador, {
          codigo: v.operador,
          nome: v.operadorNome || `Operador ${v.operador}`,
          vendas: [],
          descontos: [],
          devolucoes: []
        });
      }

      const op = operadoresMap.get(v.operador);
      if (v.quantidade > 0) {
        op.vendas.push(v);
      }
      if (v.desconto && v.desconto > 0) {
        op.descontos.push(v);
      }
      if (v.quantidade < 0) {
        op.devolucoes.push(v);
      }
    });

    // Calcular métricas por operador
    const operadores: ResumoOperador[] = Array.from(operadoresMap.values()).map(op => {
      const totalVendasOp = op.vendas.length;
      const valorTotalVendidoOp = op.vendas.reduce((sum: number, v: VendaPDV) => sum + v.valorTotal, 0);
      const qtdDescontosOp = op.descontos.length;
      const valorTotalDescontosOp = op.descontos.reduce(
        (sum: number, v: VendaPDV) => sum + (v.desconto || 0),
        0
      );
      const qtdDevolucoesOp = op.devolucoes.length;
      const valorTotalDevolucoesOp = Math.abs(
        op.devolucoes.reduce((sum: number, v: VendaPDV) => sum + v.valorTotal, 0)
      );

      return {
        codigo: op.codigo,
        nome: op.nome,
        totalVendas: totalVendasOp,
        valorTotalVendido: valorTotalVendidoOp,
        qtdDescontos: qtdDescontosOp,
        valorTotalDescontos: valorTotalDescontosOp,
        percentualDescontos: totalVendasOp > 0 ? (qtdDescontosOp / totalVendasOp) * 100 : 0,
        qtdDevolucoes: qtdDevolucoesOp,
        valorTotalDevolucoes: valorTotalDevolucoesOp,
        percentualDevolucoes: totalVendasOp > 0 ? (qtdDevolucoesOp / totalVendasOp) * 100 : 0
      };
    });

    // Ordenar por valor total vendido
    operadores.sort((a, b) => b.valorTotalVendido - a.valorTotalVendido);

    return {
      totalVendas,
      valorTotalVendido,
      qtdDescontos,
      valorTotalDescontos,
      percentualDescontos,
      qtdDevolucoes,
      valorTotalDevolucoes,
      percentualDevolucoes,
      operadores
    };
  }
}
