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
   * Helper para buscar mapeamentos das tabelas de cotação
   */
  private static async getCotacaoMappings() {
    const schema = await MappingService.getSchema();

    // Tabelas
    const [tabCota, tabCotaProd, tabCotaForn, tabProduto, tabFornecedor] = await Promise.all([
      MappingService.getRealTableName('TAB_COTA'),
      MappingService.getRealTableName('TAB_COTA_PROD'),
      MappingService.getRealTableName('TAB_COTA_FORN'),
      MappingService.getRealTableName('TAB_PRODUTO'),
      MappingService.getRealTableName('TAB_FORNECEDOR'),
    ]);

    // Colunas TAB_COTA
    const [cCodCota, cCodLoja, cDesCota, cDtaCota, cUsuario, cDtaAlteracao] = await Promise.all([
      MappingService.getColumnFromTable('TAB_COTA', 'codigo_cota'),
      MappingService.getColumnFromTable('TAB_COTA', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_COTA', 'descricao_cota'),
      MappingService.getColumnFromTable('TAB_COTA', 'data_cota'),
      MappingService.getColumnFromTable('TAB_COTA', 'usuario'),
      MappingService.getColumnFromTable('TAB_COTA', 'data_alteracao'),
    ]);

    // Colunas TAB_COTA_PROD
    const [cpCodCota, cpCodLoja, cpCodProduto, cpQtdPedido, cpValCustoRep, cpValVenda,
      cpQtdEstoque, cpQtdCobertura, cpDtaUltCompra, cpCodFornUltCompra, cpQtdVda30d] = await Promise.all([
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'codigo_cota'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'quantidade_pedido'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'valor_custo_rep'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'valor_venda'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'quantidade_estoque'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'quantidade_cobertura'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'data_ultima_compra'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'codigo_forn_ultima_compra'),
      MappingService.getColumnFromTable('TAB_COTA_PROD', 'quantidade_venda_30d'),
    ]);

    // Colunas TAB_COTA_FORN
    const [cfCodCota, cfCodLoja, cfCodProduto, cfCodFornecedor, cfValCustoTab, cfValCustoCalc,
      cfPerDesconto, cfQtdPedido, cfNumPedido] = await Promise.all([
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'codigo_cota'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'codigo_fornecedor'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'valor_custo_tabela'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'valor_custo_calculado'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'percentual_desconto'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'quantidade_pedido'),
      MappingService.getColumnFromTable('TAB_COTA_FORN', 'numero_pedido'),
    ]);

    // Colunas TAB_PRODUTO
    const [pCodProduto, pDesProduto, pDesReduzida, pCodBarra, pDesUnidadeCompra, pQtdEmbCompra] = await Promise.all([
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'des_unidade_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_compra'),
    ]);

    // Colunas TAB_FORNECEDOR
    const [fCodFornecedor, fDesFornecedor, fNumPrazo, fPedMinVal] = await Promise.all([
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'prazo_entrega'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'pedido_minimo_valor'),
    ]);

    return {
      schema,
      tabCota: `${schema}.${tabCota}`, tabCotaProd: `${schema}.${tabCotaProd}`,
      tabCotaForn: `${schema}.${tabCotaForn}`, tabProduto: `${schema}.${tabProduto}`,
      tabFornecedor: `${schema}.${tabFornecedor}`,
      // TAB_COTA
      cCodCota, cCodLoja, cDesCota, cDtaCota, cUsuario, cDtaAlteracao,
      // TAB_COTA_PROD
      cpCodCota, cpCodLoja, cpCodProduto, cpQtdPedido, cpValCustoRep, cpValVenda,
      cpQtdEstoque, cpQtdCobertura, cpDtaUltCompra, cpCodFornUltCompra, cpQtdVda30d,
      // TAB_COTA_FORN
      cfCodCota, cfCodLoja, cfCodProduto, cfCodFornecedor, cfValCustoTab, cfValCustoCalc,
      cfPerDesconto, cfQtdPedido, cfNumPedido,
      // TAB_PRODUTO
      pCodProduto, pDesProduto, pDesReduzida, pCodBarra, pDesUnidadeCompra, pQtdEmbCompra,
      // TAB_FORNECEDOR
      fCodFornecedor, fDesFornecedor, fNumPrazo, fPedMinVal,
    };
  }

  /**
   * Lista todas as cotações disponíveis (header)
   */
  static async listarCotacoes(codLoja?: number): Promise<CotacaoHeader[]> {
    const m = await this.getCotacaoMappings();

    let sql = `
      SELECT * FROM (
        SELECT c.${m.cCodCota} as COD_COTA, c.${m.cCodLoja} as COD_LOJA, c.${m.cDesCota} as DES_COTA, c.${m.cDtaCota} as DTA_COTA, c.${m.cUsuario} as USUARIO, c.${m.cDtaAlteracao} as DTA_ALTERACAO,
          (SELECT COUNT(*) FROM ${m.tabCotaProd} cp WHERE cp.${m.cpCodCota} = c.${m.cCodCota} AND cp.${m.cpCodLoja} = c.${m.cCodLoja}) as TOTAL_PRODUTOS,
          (SELECT COUNT(DISTINCT cf.${m.cfCodFornecedor}) FROM ${m.tabCotaForn} cf WHERE cf.${m.cfCodCota} = c.${m.cCodCota} AND cf.${m.cfCodLoja} = c.${m.cCodLoja}) as TOTAL_FORNECEDORES
        FROM ${m.tabCota} c
    `;
    const params: any = {};

    if (codLoja) {
      sql += ` WHERE c.${m.cCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    sql += ` ORDER BY c.${m.cCodCota} DESC
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
    const m = await this.getCotacaoMappings();

    // 1. Buscar produtos da cotação
    const sqlProd = `
      SELECT cp.${m.cpCodProduto} as COD_PRODUTO, p.${m.pDesProduto} as DES_PRODUTO, p.${m.pDesReduzida} as DES_REDUZIDA, p.${m.pCodBarra} as COD_BARRA_PRINCIPAL,
        cp.${m.cpQtdPedido} as QTD_PEDIDO, cp.${m.cpValCustoRep} as VAL_CUSTO_REP, cp.${m.cpValVenda} as VAL_VENDA,
        cp.${m.cpQtdEstoque} as QTD_ESTOQUE, cp.${m.cpQtdCobertura} as QTD_COBERTURA, cp.${m.cpDtaUltCompra} as DTA_ULT_COMPRA, cp.${m.cpCodFornUltCompra} as COD_FORN_ULT_COMPRA,
        cp.${m.cpQtdVda30d} as QTD_VDA_ULT_30D,
        p.${m.pDesUnidadeCompra} as DES_UNIDADE_COMPRA, p.${m.pQtdEmbCompra} as QTD_EMBALAGEM_COMPRA
      FROM ${m.tabCotaProd} cp
      LEFT JOIN ${m.tabProduto} p ON p.${m.pCodProduto} = cp.${m.cpCodProduto}
      WHERE cp.${m.cpCodCota} = :codCota AND cp.${m.cpCodLoja} = :codLoja
      ORDER BY p.${m.pDesProduto}
    `;
    const produtos = await OracleService.query<any>(sqlProd, { codCota, codLoja });

    // 2. Buscar todos os preços de fornecedores de uma vez
    const sqlForn = `
      SELECT cf.${m.cfCodProduto} as COD_PRODUTO, cf.${m.cfCodFornecedor} as COD_FORNECEDOR, f.${m.fDesFornecedor} as DES_FORNECEDOR,
        cf.${m.cfValCustoTab} as VAL_CUSTO_TAB, cf.${m.cfValCustoCalc} as VAL_CUSTO_CALC, cf.${m.cfPerDesconto} as PER_DESCONTO,
        cf.${m.cfQtdPedido} as QTD_PEDIDO, cf.${m.cfNumPedido} as NUM_PEDIDO,
        NVL(f.${m.fNumPrazo}, 0) as NUM_PRAZO
      FROM ${m.tabCotaForn} cf
      LEFT JOIN ${m.tabFornecedor} f ON f.${m.fCodFornecedor} = cf.${m.cfCodFornecedor}
      WHERE cf.${m.cfCodCota} = :codCota AND cf.${m.cfCodLoja} = :codLoja
      ORDER BY cf.${m.cfCodProduto}, cf.${m.cfValCustoTab}
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
    const m = await this.getCotacaoMappings();

    // Buscar todos os preços + pedido mínimo do fornecedor + qtd pedido do produto + embalagem
    const sql = `
      SELECT cf.${m.cfCodProduto} as COD_PRODUTO, cf.${m.cfCodFornecedor} as COD_FORNECEDOR, f.${m.fDesFornecedor} as DES_FORNECEDOR,
        cf.${m.cfValCustoTab} as VAL_CUSTO_TAB, cf.${m.cfNumPedido} as NUM_PEDIDO, cf.${m.cfQtdPedido} as QTD_PEDIDO,
        NVL(f.${m.fPedMinVal}, 0) as PED_MIN_VAL,
        NVL(f.${m.fNumPrazo}, 0) as NUM_PRAZO,
        NVL(cp.${m.cpQtdPedido}, 0) as QTD_PEDIDO_PROD,
        NVL(p.${m.pQtdEmbCompra}, 1) as QTD_EMB
      FROM ${m.tabCotaForn} cf
      LEFT JOIN ${m.tabFornecedor} f ON f.${m.fCodFornecedor} = cf.${m.cfCodFornecedor}
      LEFT JOIN ${m.tabCotaProd} cp ON cp.${m.cpCodCota} = cf.${m.cfCodCota} AND cp.${m.cpCodLoja} = cf.${m.cfCodLoja} AND cp.${m.cpCodProduto} = cf.${m.cfCodProduto}
      LEFT JOIN ${m.tabProduto} p ON p.${m.pCodProduto} = cf.${m.cfCodProduto}
      WHERE cf.${m.cfCodCota} = :codCota AND cf.${m.cfCodLoja} = :codLoja
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
