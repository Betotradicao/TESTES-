import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface CotacaoHeader {
  codCota: number;
  codLoja: number;
  desCota: string;
  dtaCota: string;
  usuario: string;
  totalProdutos?: number;
  totalFornecedores?: number;
}

export interface CotacaoProduto {
  codProduto: string;
  desProduto: string;
  desReduzida: string;
  codBarra: string;
  unidadeCompra: string;
  qtdEmbalagem: number;
  qtdPedido: number;
  qtdEstoque: number;
  qtdCobertura: number;
  valCustoRep: number;
  valVenda: number;
  dtaUltCompra: string | null;
  codFornUltCompra: number;
  qtdVda30d: number;
  fornecedores: CotacaoFornecedorPreco[];
  vencedor: CotacaoFornecedorPreco | null;
  segundo: CotacaoFornecedorPreco | null;
  terceiro: CotacaoFornecedorPreco | null;
}

export interface CotacaoFornecedorPreco {
  codFornecedor: number;
  desFornecedor: string;
  valCustoTab: number;
  valCustoCalc: number;
  perDesconto: number;
  qtdPedido: number;
  numPedido: number;
  ganhouPedido: boolean;
  prazoEntrega: number;
}

export interface RankingFornecedor {
  codFornecedor: number;
  desFornecedor: string;
  qtdMaisBarato: number;
  qtdSegundo: number;
  qtdTerceiro: number;
  qtdCotou: number;
  qtdGanhouPedido: number;
  valorTotalPedidos: number;
  valorTotalPedidosEmb: number;
  pedidoMinimo: number;
  prazoEntrega: number;
}

export class AnaliseCotacaoService {

  /**
   * Lista todas as cotações disponíveis (header)
   */
  static async listarCotacoes(codLoja?: number): Promise<CotacaoHeader[]> {
    const schema = await MappingService.getSchema();

    let sql = `
      SELECT * FROM (
        SELECT c.COD_COTA, c.COD_LOJA, c.DES_COTA, c.DTA_COTA, c.USUARIO, c.DTA_ALTERACAO,
          (SELECT COUNT(*) FROM ${schema}.TAB_COTA_PROD cp WHERE cp.COD_COTA = c.COD_COTA AND cp.COD_LOJA = c.COD_LOJA) as TOTAL_PRODUTOS,
          (SELECT COUNT(*) FROM ${schema}.TAB_FORN_COTA fc WHERE fc.COD_COTA = c.COD_COTA AND fc.COD_LOJA = c.COD_LOJA) as TOTAL_FORNECEDORES
        FROM ${schema}.TAB_COTA c
    `;
    const params: any = {};

    if (codLoja) {
      sql += ` WHERE c.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    sql += ` ORDER BY c.COD_COTA DESC
      ) WHERE ROWNUM <= 100`;

    const rows = await OracleService.query<any>(sql, params);

    return rows.map((r: any) => ({
      codCota: r.COD_COTA,
      codLoja: r.COD_LOJA,
      desCota: r.DES_COTA,
      dtaCota: r.DTA_COTA,
      usuario: r.USUARIO,
      dtaAlteracao: r.DTA_ALTERACAO,
      totalProdutos: r.TOTAL_PRODUTOS,
      totalFornecedores: r.TOTAL_FORNECEDORES,
    }));
  }

  /**
   * Detalhes de uma cotação: produtos + preços de cada fornecedor
   */
  static async detalhesCotacao(codCota: number, codLoja: number): Promise<CotacaoProduto[]> {
    const schema = await MappingService.getSchema();

    // 1. Buscar produtos da cotação
    const sqlProd = `
      SELECT cp.COD_PRODUTO, p.DES_PRODUTO, p.DES_REDUZIDA, p.COD_BARRA_PRINCIPAL,
        cp.QTD_PEDIDO, cp.VAL_CUSTO_REP, cp.VAL_VENDA,
        cp.QTD_ESTOQUE, cp.QTD_COBERTURA, cp.DTA_ULT_COMPRA, cp.COD_FORN_ULT_COMPRA,
        cp.QTD_VDA_ULT_30D,
        p.DES_UNIDADE_COMPRA, p.QTD_EMBALAGEM_COMPRA
      FROM ${schema}.TAB_COTA_PROD cp
      LEFT JOIN ${schema}.TAB_PRODUTO p ON p.COD_PRODUTO = cp.COD_PRODUTO
      WHERE cp.COD_COTA = :codCota AND cp.COD_LOJA = :codLoja
      ORDER BY p.DES_PRODUTO
    `;
    const produtos = await OracleService.query<any>(sqlProd, { codCota, codLoja });

    // 2. Buscar todos os preços de fornecedores de uma vez
    const sqlForn = `
      SELECT cf.COD_PRODUTO, cf.COD_FORNECEDOR, f.DES_FORNECEDOR,
        cf.VAL_CUSTO_TAB, cf.VAL_CUSTO_CALC, cf.PER_DESCONTO,
        cf.QTD_PEDIDO, cf.NUM_PEDIDO,
        NVL(f.NUM_PRAZO, 0) as NUM_PRAZO
      FROM ${schema}.TAB_COTA_FORN cf
      LEFT JOIN ${schema}.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = cf.COD_FORNECEDOR
      WHERE cf.COD_COTA = :codCota AND cf.COD_LOJA = :codLoja
      ORDER BY cf.COD_PRODUTO, cf.VAL_CUSTO_TAB
    `;
    const fornPrecos = await OracleService.query<any>(sqlForn, { codCota, codLoja });

    // Agrupar preços por produto
    const precosPorProduto: Record<string, CotacaoFornecedorPreco[]> = {};
    for (const fp of fornPrecos) {
      const cod = fp.COD_PRODUTO;
      if (!precosPorProduto[cod]) precosPorProduto[cod] = [];
      precosPorProduto[cod].push({
        codFornecedor: fp.COD_FORNECEDOR,
        desFornecedor: fp.DES_FORNECEDOR || '',
        valCustoTab: fp.VAL_CUSTO_TAB || 0,
        valCustoCalc: fp.VAL_CUSTO_CALC || 0,
        perDesconto: fp.PER_DESCONTO || 0,
        qtdPedido: fp.QTD_PEDIDO || 0,
        numPedido: fp.NUM_PEDIDO || 0,
        ganhouPedido: (fp.NUM_PEDIDO || 0) > 0,
        prazoEntrega: fp.NUM_PRAZO || 0,
      });
    }

    // Montar resultado
    return produtos.map((p: any) => {
      const forn = precosPorProduto[p.COD_PRODUTO] || [];
      // Ordenar por menor preço (ignorando 0 = não cotou)
      const cotaram = forn.filter(f => f.valCustoTab > 0).sort((a, b) => a.valCustoTab - b.valCustoTab);

      return {
        codProduto: p.COD_PRODUTO,
        desProduto: p.DES_PRODUTO || p.DES_REDUZIDA || '',
        desReduzida: p.DES_REDUZIDA || '',
        codBarra: p.COD_BARRA_PRINCIPAL || '',
        unidadeCompra: p.DES_UNIDADE_COMPRA || '',
        qtdEmbalagem: p.QTD_EMBALAGEM_COMPRA || 0,
        qtdPedido: p.QTD_PEDIDO || 0,
        qtdEstoque: p.QTD_ESTOQUE || 0,
        qtdCobertura: p.QTD_COBERTURA || 0,
        valCustoRep: p.VAL_CUSTO_REP || 0,
        valVenda: p.VAL_VENDA || 0,
        dtaUltCompra: p.DTA_ULT_COMPRA || null,
        codFornUltCompra: p.COD_FORN_ULT_COMPRA || 0,
        qtdVda30d: p.QTD_VDA_ULT_30D || 0,
        fornecedores: forn,
        vencedor: cotaram[0] || null,
        segundo: cotaram[1] || null,
        terceiro: cotaram[2] || null,
      };
    });
  }

  /**
   * Ranking de fornecedores: quem cotou mais barato, quem ganhou mais pedidos
   */
  static async rankingFornecedores(codCota: number, codLoja: number): Promise<RankingFornecedor[]> {
    const schema = await MappingService.getSchema();

    // Buscar todos os preços + pedido mínimo do fornecedor + qtd pedido do produto + embalagem
    const sql = `
      SELECT cf.COD_PRODUTO, cf.COD_FORNECEDOR, f.DES_FORNECEDOR,
        cf.VAL_CUSTO_TAB, cf.NUM_PEDIDO, cf.QTD_PEDIDO,
        NVL(f.PED_MIN_VAL, 0) as PED_MIN_VAL,
        NVL(f.NUM_PRAZO, 0) as NUM_PRAZO,
        NVL(cp.QTD_PEDIDO, 0) as QTD_PEDIDO_PROD,
        NVL(p.QTD_EMBALAGEM_COMPRA, 1) as QTD_EMB
      FROM ${schema}.TAB_COTA_FORN cf
      LEFT JOIN ${schema}.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = cf.COD_FORNECEDOR
      LEFT JOIN ${schema}.TAB_COTA_PROD cp ON cp.COD_COTA = cf.COD_COTA AND cp.COD_LOJA = cf.COD_LOJA AND cp.COD_PRODUTO = cf.COD_PRODUTO
      LEFT JOIN ${schema}.TAB_PRODUTO p ON p.COD_PRODUTO = cf.COD_PRODUTO
      WHERE cf.COD_COTA = :codCota AND cf.COD_LOJA = :codLoja
    `;
    const rows = await OracleService.query<any>(sql, { codCota, codLoja });

    // Agrupar por produto para determinar 1o, 2o, 3o mais barato
    const porProduto: Record<string, any[]> = {};
    for (const r of rows) {
      const cod = r.COD_PRODUTO;
      if (!porProduto[cod]) porProduto[cod] = [];
      porProduto[cod].push(r);
    }

    // Contadores por fornecedor
    const stats: Record<number, RankingFornecedor> = {};

    const getOrCreate = (codForn: number, desForn: string, pedMinVal?: number, numPrazo?: number) => {
      if (!stats[codForn]) {
        stats[codForn] = {
          codFornecedor: codForn,
          desFornecedor: desForn || '',
          qtdMaisBarato: 0,
          qtdSegundo: 0,
          qtdTerceiro: 0,
          qtdCotou: 0,
          qtdGanhouPedido: 0,
          valorTotalPedidos: 0,
          valorTotalPedidosEmb: 0,
          pedidoMinimo: pedMinVal || 0,
          prazoEntrega: numPrazo || 0,
        };
      }
      if (pedMinVal && pedMinVal > stats[codForn].pedidoMinimo) {
        stats[codForn].pedidoMinimo = pedMinVal;
      }
      if (numPrazo && numPrazo > 0 && stats[codForn].prazoEntrega === 0) {
        stats[codForn].prazoEntrega = numPrazo;
      }
      return stats[codForn];
    };

    for (const codProd of Object.keys(porProduto)) {
      const fornecedores = porProduto[codProd];
      const cotaram = fornecedores.filter((f: any) => (f.VAL_CUSTO_TAB || 0) > 0);
      cotaram.sort((a: any, b: any) => a.VAL_CUSTO_TAB - b.VAL_CUSTO_TAB);

      for (const f of fornecedores) {
        const s = getOrCreate(f.COD_FORNECEDOR, f.DES_FORNECEDOR, f.PED_MIN_VAL || 0, f.NUM_PRAZO || 0);
        if ((f.VAL_CUSTO_TAB || 0) > 0) s.qtdCotou++;
        if ((f.NUM_PEDIDO || 0) > 0) s.qtdGanhouPedido++;
      }

      // Mais barato: somar valor da compra (preco * qtd do produto na cotacao)
      if (cotaram[0]) {
        const s = getOrCreate(cotaram[0].COD_FORNECEDOR, cotaram[0].DES_FORNECEDOR, cotaram[0].PED_MIN_VAL || 0, cotaram[0].NUM_PRAZO || 0);
        s.qtdMaisBarato++;
        const preco = cotaram[0].VAL_CUSTO_TAB || 0;
        const qtdPed = cotaram[0].QTD_PEDIDO_PROD || 0;
        const qtdEmb = cotaram[0].QTD_EMB || 1;
        s.valorTotalPedidos += preco * qtdPed;
        s.valorTotalPedidosEmb += preco * qtdPed * qtdEmb;
      }
      if (cotaram[1]) getOrCreate(cotaram[1].COD_FORNECEDOR, cotaram[1].DES_FORNECEDOR, cotaram[1].PED_MIN_VAL || 0, cotaram[1].NUM_PRAZO || 0).qtdSegundo++;
      if (cotaram[2]) getOrCreate(cotaram[2].COD_FORNECEDOR, cotaram[2].DES_FORNECEDOR, cotaram[2].PED_MIN_VAL || 0, cotaram[2].NUM_PRAZO || 0).qtdTerceiro++;
    }

    return Object.values(stats)
      .filter(s => s.qtdCotou > 0)
      .sort((a, b) => b.qtdMaisBarato - a.qtdMaisBarato);
  }
}
