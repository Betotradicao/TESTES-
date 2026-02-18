/**
 * Ofertas Service
 * Consulta programacoes/ofertas ativas do Oracle (TAB_PROGRAMACAO + TAB_PRODUTO_PROG)
 * com dados enriquecidos de produto, estoque, preco e margem.
 *
 * TAB_PROGRAMACAO e TAB_PRODUTO_PROG: colunas diretas (nao estao no MappingService)
 * TAB_PRODUTO e TAB_PRODUTO_LOJA: resolvidos via MappingService
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface Programacao {
  COD_PROG: number;
  DES_PROGRAMACAO: string;
  DTA_INICIAL: string;
  DTA_FINAL: string;
  TIPO_PROGRAMACAO: string;
  COD_LOJA: number;
  TOTAL_PRODUTOS: number;
}

export interface ProdutoOferta {
  COD_PRODUTO: string;
  DESCRICAO: string;
  COD_BARRAS: string;
  CUSTO: number;
  PRECO_NORMAL: number;
  PRECO_OFERTA: number;
  MARGEM_NORMAL: number;
  MARGEM_OFERTA: number;
  ESTOQUE: number;
  VD_MEDIA: number;
  DIAS_COBERTURA: number;
  CURVA: string;
  SECAO: string;
  COD_SECAO: number;
  FORNECEDOR: string;
  COD_FORNECEDOR: number;
}

export class OfertasService {

  /**
   * Lista programacoes (ativas ou todas)
   */
  static async getProgramacoes(codLoja: number, ativas: boolean = true): Promise<Programacao[]> {
    const schema = await MappingService.getSchema();

    let whereAtivas = '';
    if (ativas) {
      whereAtivas = `AND pg.DTA_FINAL >= TRUNC(SYSDATE)
      AND pg.DTA_INICIAL <= TRUNC(SYSDATE)`;
    }

    const sql = `
      SELECT
        pg.COD_PROG,
        pg.DES_PROGRAMACAO,
        TO_CHAR(pg.DTA_INICIAL, 'DD/MM/YYYY') as DTA_INICIAL,
        TO_CHAR(pg.DTA_FINAL, 'DD/MM/YYYY') as DTA_FINAL,
        pg.TIPO_PROGRAMACAO,
        pg.COD_LOJA,
        (SELECT COUNT(*) FROM ${schema}.TAB_PRODUTO_PROG pp WHERE pp.COD_PROG = pg.COD_PROG AND pp.COD_LOJA = pg.COD_LOJA) as TOTAL_PRODUTOS
      FROM ${schema}.TAB_PROGRAMACAO pg
      WHERE pg.COD_LOJA = :codLoja
      ${whereAtivas}
      ORDER BY pg.DTA_FINAL DESC, pg.DES_PROGRAMACAO
    `;

    const result = await OracleService.query<any>(sql, { codLoja });

    return result.map((row: any) => ({
      COD_PROG: Number(row.COD_PROG),
      DES_PROGRAMACAO: row.DES_PROGRAMACAO || '',
      DTA_INICIAL: row.DTA_INICIAL || '',
      DTA_FINAL: row.DTA_FINAL || '',
      TIPO_PROGRAMACAO: row.TIPO_PROGRAMACAO || '',
      COD_LOJA: Number(row.COD_LOJA),
      TOTAL_PRODUTOS: Number(row.TOTAL_PRODUTOS) || 0,
    }));
  }

  /**
   * Busca produtos de uma programacao com dados enriquecidos
   */
  static async getProdutos(codProg: number, codLoja: number): Promise<{
    produtos: ProdutoOferta[];
    resumo: {
      totalProdutos: number;
      estZerado: number;
      margemMediaOferta: number;
      margemMediaNormal: number;
      valorEstoque: number;
      difMargem: number;
    };
  }> {
    const schema = await MappingService.getSchema();

    // Resolver colunas via MappingService para TAB_PRODUTO e TAB_PRODUTO_LOJA
    const colCodProdutoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');

    const colCodProdutoPL = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaPL = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');

    // Resolver nomes reais das tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    // Resolver colunas opcionais com fallback
    let colValVenda = 'VAL_VENDA';
    let colValCusto = 'VAL_CUSTO_REP';
    let colEstoque = 'QTD_ESTOQUE';
    let colCurva = 'CURVA';
    let colCodFornecedor = 'COD_FORNECEDOR';
    let colVdMedia = 'VD_MEDIA';
    let colCodBarras = 'COD_BARRA_PRINCIPAL';

    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda'); if (v) colValVenda = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'custo_reposicao'); if (v) colValCusto = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque'); if (v) colEstoque = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva'); if (v) colCurva = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor'); if (v) colCodFornecedor = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media'); if (v) colVdMedia = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'); if (v) colCodBarras = v; } catch {}

    // Resolver colunas da secao e fornecedor
    const colCodSecaoS = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    let colCodFornecedorF = 'COD_FORNECEDOR';
    let colDesFornecedor = 'DES_FORNECEDOR';
    try { const v = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor'); if (v) colCodFornecedorF = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'descricao_fornecedor'); if (v) colDesFornecedor = v; } catch {}

    const sql = `
      SELECT
        pp.COD_PRODUTO,
        p.${colDesProduto} as DESCRICAO,
        p.${colCodBarras} as COD_BARRAS,
        NVL(pl.${colValCusto}, 0) as CUSTO,
        NVL(pl.${colValVenda}, 0) as PRECO_NORMAL,
        NVL(pp.VAL_PROG, 0) as PRECO_OFERTA,
        NVL(pl.${colEstoque}, 0) as ESTOQUE,
        NVL(pl.${colVdMedia}, 0) as VD_MEDIA,
        NVL(pl.${colCurva}, 'X') as CURVA,
        s.${colDesSecao} as SECAO,
        p.${colCodSecaoP} as COD_SECAO,
        f.${colDesFornecedor} as FORNECEDOR,
        p.${colCodFornecedor} as COD_FORNECEDOR
      FROM ${schema}.TAB_PRODUTO_PROG pp
      JOIN ${tabProduto} p ON pp.COD_PRODUTO = p.${colCodProdutoP}
      JOIN ${tabProdutoLoja} pl ON pp.COD_PRODUTO = pl.${colCodProdutoPL}
        AND pp.COD_LOJA = pl.${colCodLojaPL}
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoP} = s.${colCodSecaoS}
      LEFT JOIN ${tabFornecedor} f ON p.${colCodFornecedor} = f.${colCodFornecedorF}
      WHERE pp.COD_PROG = :codProg
        AND pp.COD_LOJA = :codLoja
      ORDER BY s.${colDesSecao}, p.${colDesProduto}
    `;

    const rows = await OracleService.query<any>(sql, { codProg, codLoja });

    const produtos: ProdutoOferta[] = rows.map((row: any) => {
      const custo = parseFloat(row.CUSTO) || 0;
      const precoNormal = parseFloat(row.PRECO_NORMAL) || 0;
      const precoOferta = parseFloat(row.PRECO_OFERTA) || 0;
      const estoque = parseFloat(row.ESTOQUE) || 0;
      const vdMedia = parseFloat(row.VD_MEDIA) || 0;

      const margemNormal = precoNormal > 0 ? ((precoNormal - custo) / precoNormal) * 100 : 0;
      const margemOferta = precoOferta > 0 ? ((precoOferta - custo) / precoOferta) * 100 : 0;
      const diasCobertura = vdMedia > 0 ? estoque / vdMedia : 0;

      return {
        COD_PRODUTO: String(row.COD_PRODUTO),
        DESCRICAO: row.DESCRICAO || '',
        COD_BARRAS: row.COD_BARRAS || '',
        CUSTO: custo,
        PRECO_NORMAL: precoNormal,
        PRECO_OFERTA: precoOferta,
        MARGEM_NORMAL: Math.round(margemNormal * 10) / 10,
        MARGEM_OFERTA: Math.round(margemOferta * 10) / 10,
        ESTOQUE: estoque,
        VD_MEDIA: Math.round(vdMedia * 100) / 100,
        DIAS_COBERTURA: Math.round(diasCobertura * 10) / 10,
        CURVA: row.CURVA || 'X',
        SECAO: row.SECAO || '',
        COD_SECAO: Number(row.COD_SECAO) || 0,
        FORNECEDOR: row.FORNECEDOR || '',
        COD_FORNECEDOR: Number(row.COD_FORNECEDOR) || 0,
      };
    });

    // Calcular resumo
    const totalProdutos = produtos.length;
    const estZerado = produtos.filter(p => p.ESTOQUE <= 0).length;
    const margemMediaOferta = totalProdutos > 0
      ? Math.round((produtos.reduce((s, p) => s + p.MARGEM_OFERTA, 0) / totalProdutos) * 10) / 10
      : 0;
    const margemMediaNormal = totalProdutos > 0
      ? Math.round((produtos.reduce((s, p) => s + p.MARGEM_NORMAL, 0) / totalProdutos) * 10) / 10
      : 0;
    const valorEstoque = Math.round(produtos.reduce((s, p) => s + (p.ESTOQUE * p.CUSTO), 0) * 100) / 100;
    const difMargem = Math.round((margemMediaNormal - margemMediaOferta) * 10) / 10;

    return {
      produtos,
      resumo: {
        totalProdutos,
        estZerado,
        margemMediaOferta,
        margemMediaNormal,
        valorEstoque,
        difMargem,
      },
    };
  }
}
