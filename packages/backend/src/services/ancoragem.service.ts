/**
 * Ancoragem de Preco Service
 * Classificacao de marcas por tier + Regua de preco + Analise/Simulacao
 * Fonte: Oracle (produtos/marcas) + PostgreSQL (classificacoes/regras)
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { AppDataSource } from '../config/database';

export interface AncoragemProduct {
  COD_PRODUTO: string;
  DESCRICAO: string;
  COD_BARRAS: string;
  DES_SEGMENTO: string;
  COD_MARCA: number;
  DES_MARCA: string;
  PRECO_VENDA: number;
  VAL_CUSTO: number;
  VAL_MARGEM: number;
  CURVA: string;
  CONC_BARATO: number;
  CONC_NOME: string;
  VD_MEDIA: number;
}

export interface AncoragemClassificacao {
  cod_produto: string;
  tier: string;
  cod_marca?: number;
  des_marca?: string;
  cod_secao: number;
  cod_grupo: number;
  cod_subgrupo: number;
  cod_segmento: number;
}

export interface AncoragemRegra {
  tier: string;
  tipo_gap: string;    // '%' ou 'R$'
  valor_gap: number;
  tier_referencia: string;
  cod_secao: number;
  cod_grupo: number;
  cod_subgrupo: number;
  cod_segmento: number;
}

export class AncoragemService {

  /**
   * Busca produtos do Oracle com marca, preco, custo, margem, pesquisa concorrente
   */
  static async getProducts(
    codLoja: number,
    codSecao: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<AncoragemProduct[]> {
    const schema = await MappingService.getSchema();

    // Resolver tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

    // Resolver colunas TAB_PRODUTO
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');

    // Resolver colunas TAB_PRODUTO_LOJA
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    // Colunas opcionais com fallback seguro
    let colSegmentoProd = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
      if (mapped) colSegmentoProd = mapped;
    } catch (e) { /* usa default */ }

    let colMargem = 'VAL_MARGEM';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
      if (mapped) colMargem = mapped;
    } catch (e) { /* usa default */ }

    let colPesquisaMedia = 'VAL_PESQUISA_MEDIA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
      if (mapped) colPesquisaMedia = mapped;
    } catch (e) { /* usa default */ }

    let colPesquisaConcorrente = 'DES_PESQUISA_CONCORRENTE';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
      if (mapped) colPesquisaConcorrente = mapped;
    } catch (e) { /* usa default */ }

    let colVendaMedia = 'VAL_VENDA_MEDIA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
      if (mapped) colVendaMedia = mapped;
    } catch (e) { /* usa default */ }

    // COD_MARCA no TAB_PRODUTO (pode nao existir)
    let colCodMarca = 'COD_MARCA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_marca');
      if (mapped) colCodMarca = mapped;
    } catch (e) { /* usa default */ }

    // Verificar se TAB_MARCA existe e resolver
    let tabMarca = '';
    let colCodMarcaTab = 'COD_MARCA';
    let colDesMarcaTab = 'DES_MARCA';
    let hasMarcaTable = false;
    try {
      const realMarca = await MappingService.getRealTableName('TAB_MARCA');
      tabMarca = `${schema}.${realMarca}`;
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_MARCA', 'codigo_marca');
        if (mapped) colCodMarcaTab = mapped;
      } catch (e) { /* usa default */ }
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_MARCA', 'descricao_marca');
        if (mapped) colDesMarcaTab = mapped;
      } catch (e) { /* usa default */ }
      // Verificar se a tabela realmente existe no Oracle
      const checkTable = `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${realMarca.replace(/"/g, '')}'`;
      const tableRes = await OracleService.query<any>(checkTable);
      hasMarcaTable = tableRes.length > 0;
    } catch (e) {
      console.log('[Ancoragem] TAB_MARCA nao encontrada, usando fallback sem marca');
    }

    // Verificar se COD_MARCA existe em TAB_PRODUTO
    let hasCodMarcaProd = false;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colCodMarca}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      hasCodMarcaProd = checkRes.length > 0;
    } catch (e) { /* nao tem */ }

    // Verificar colunas de pesquisa
    let pesquisaMediaSelect = '0 AS CONC_BARATO';
    let pesquisaConcorrenteSelect = "NULL AS CONC_NOME";
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colPesquisaMedia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        pesquisaMediaSelect = `NVL(pl.${colPesquisaMedia}, 0) AS CONC_BARATO`;
      }
      const checkSql2 = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colPesquisaConcorrente}'`;
      const checkRes2 = await OracleService.query<any>(checkSql2);
      if (checkRes2.length > 0) {
        pesquisaConcorrenteSelect = `pl.${colPesquisaConcorrente} AS CONC_NOME`;
      }
    } catch (e) {
      console.log('[Ancoragem] Erro verificando colunas de pesquisa');
    }

    // Verificar coluna margem
    let margemSelect = '0 AS VAL_MARGEM';
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colMargem}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        margemSelect = `NVL(pl.${colMargem}, 0) AS VAL_MARGEM`;
      }
    } catch (e) { /* usa default */ }

    // Verificar coluna venda media
    let vendaMediaSelect = '0 AS VD_MEDIA';
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colVendaMedia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        vendaMediaSelect = `NVL(pl.${colVendaMedia}, 0) AS VD_MEDIA`;
      }
    } catch (e) { /* usa default */ }

    // Resolver TAB_SEGMENTO para DES_SEGMENTO
    let segmentoSelect = "' ' AS DES_SEGMENTO";
    let segmentoJoin = '';
    try {
      const realSeg = await MappingService.getRealTableName('TAB_SEGMENTO');
      const tabSegmento = `${schema}.${realSeg}`;
      let colCodSegTab = 'COD_SEGMENTO';
      let colDesSegTab = 'DES_SEGMENTO';
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_SEGMENTO', 'codigo_segmento');
        if (mapped) colCodSegTab = mapped;
      } catch (e) { /* usa default */ }
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_SEGMENTO', 'descricao_segmento');
        if (mapped) colDesSegTab = mapped;
      } catch (e) { /* usa default */ }
      // Verificar se TAB_SEGMENTO existe
      const checkSeg = `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${realSeg.replace(/"/g, '')}'`;
      const segRes = await OracleService.query<any>(checkSeg);
      if (segRes.length > 0) {
        segmentoSelect = `NVL(seg.${colDesSegTab}, ' ') AS DES_SEGMENTO`;
        segmentoJoin = `LEFT JOIN ${tabSegmento} seg ON p.${colSegmentoProd} = seg.${colCodSegTab}`;
      }
    } catch (e) {
      console.log('[Ancoragem] TAB_SEGMENTO nao encontrada, sem descricao de segmento');
    }

    // Build marca SELECT e JOIN
    let marcaSelect = "0 AS COD_MARCA, ' ' AS DES_MARCA";
    let marcaJoin = '';
    if (hasCodMarcaProd && hasMarcaTable) {
      marcaSelect = `NVL(p.${colCodMarca}, 0) AS COD_MARCA, NVL(m.${colDesMarcaTab}, ' ') AS DES_MARCA`;
      marcaJoin = `LEFT JOIN ${tabMarca} m ON p.${colCodMarca} = m.${colCodMarcaTab}`;
    } else if (hasCodMarcaProd) {
      marcaSelect = `NVL(p.${colCodMarca}, 0) AS COD_MARCA, ' ' AS DES_MARCA`;
    }

    // Filtros dinamicos
    let filtroGrupo = '';
    let filtroSubgrupo = '';
    let filtroSegmento = '';
    const params: any = { codLoja, codSecao };

    if (codGrupo) {
      filtroGrupo = `AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = codGrupo;
    }
    if (codSubGrupo) {
      filtroSubgrupo = `AND p.${colCodSubgrupoProd} = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }
    if (codSegmento) {
      filtroSegmento = `AND p.${colSegmentoProd} = :codSegmento`;
      params.codSegmento = codSegmento;
    }

    const sql = `
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colDesProduto} AS DESCRICAO,
        p.${colCodBarras} AS COD_BARRAS,
        ${segmentoSelect},
        ${marcaSelect},
        NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
        NVL(pl.${colPrecoCusto}, 0) AS VAL_CUSTO,
        ${margemSelect},
        NVL(pl.${colCurva}, ' ') AS CURVA,
        ${pesquisaMediaSelect},
        ${pesquisaConcorrenteSelect},
        ${vendaMediaSelect}
      FROM ${tabProduto} p
      JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja} AND pl.${colCodLojaLoja} = :codLoja
      ${marcaJoin}
      ${segmentoJoin}
      WHERE p.${colCodSecaoProd} = :codSecao
        ${filtroGrupo}
        ${filtroSubgrupo}
        ${filtroSegmento}
      ORDER BY p.${colDesProduto}
    `;

    console.log(`[Ancoragem] getProducts: Loja=${codLoja}, Secao=${codSecao}, Grupo=${codGrupo || 'todos'}, Sub=${codSubGrupo || 'todos'}, Seg=${codSegmento || 'todos'}`);

    const rawRows = await OracleService.query<any>(sql, params);
    console.log(`[Ancoragem] ${rawRows.length} produtos encontrados`);

    return rawRows.map((r: any) => ({
      COD_PRODUTO: String(r.COD_PRODUTO),
      DESCRICAO: r.DESCRICAO || '',
      COD_BARRAS: String(r.COD_BARRAS || '').trim(),
      DES_SEGMENTO: (r.DES_SEGMENTO || '').trim(),
      COD_MARCA: r.COD_MARCA || 0,
      DES_MARCA: (r.DES_MARCA || '').trim(),
      PRECO_VENDA: r.PRECO_VENDA || 0,
      VAL_CUSTO: r.VAL_CUSTO || 0,
      VAL_MARGEM: r.VAL_MARGEM || 0,
      CURVA: (r.CURVA || '').trim(),
      CONC_BARATO: r.CONC_BARATO || 0,
      CONC_NOME: (r.CONC_NOME || '').trim(),
      VD_MEDIA: r.VD_MEDIA || 0,
    }));
  }

  /**
   * Busca classificacoes salvas no PostgreSQL
   */
  static async getClassificacoes(
    codLoja: number,
    codSecao: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<any[]> {
    let sql = `SELECT * FROM ancoragem_classificacao WHERE cod_loja = $1 AND cod_secao = $2`;
    const params: any[] = [codLoja, codSecao];
    let idx = 3;

    if (codGrupo) {
      sql += ` AND cod_grupo = $${idx++}`;
      params.push(codGrupo);
    }
    if (codSubGrupo) {
      sql += ` AND cod_subgrupo = $${idx++}`;
      params.push(codSubGrupo);
    }
    if (codSegmento) {
      sql += ` AND cod_segmento = $${idx++}`;
      params.push(codSegmento);
    }

    return AppDataSource.query(sql, params);
  }

  /**
   * Salva classificacoes (UPSERT)
   */
  static async saveClassificacoes(codLoja: number, items: AncoragemClassificacao[]): Promise<void> {
    if (!items || items.length === 0) return;

    for (const item of items) {
      await AppDataSource.query(
        `INSERT INTO ancoragem_classificacao (cod_loja, cod_secao, cod_grupo, cod_subgrupo, cod_segmento, cod_produto, cod_marca, des_marca, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (cod_loja, cod_produto) DO UPDATE SET
           tier = EXCLUDED.tier,
           cod_marca = EXCLUDED.cod_marca,
           des_marca = EXCLUDED.des_marca,
           cod_secao = EXCLUDED.cod_secao,
           cod_grupo = EXCLUDED.cod_grupo,
           cod_subgrupo = EXCLUDED.cod_subgrupo,
           cod_segmento = EXCLUDED.cod_segmento,
           updated_at = now()`,
        [codLoja, item.cod_secao, item.cod_grupo || 0, item.cod_subgrupo || 0, item.cod_segmento || 0, item.cod_produto, item.cod_marca || 0, item.des_marca || '', item.tier]
      );
    }

    console.log(`[Ancoragem] ${items.length} classificacoes salvas para loja ${codLoja}`);
  }

  /**
   * Busca regras de gap salvas no PostgreSQL
   */
  static async getRegras(
    codLoja: number,
    codSecao: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<any[]> {
    let sql = `SELECT * FROM ancoragem_regras WHERE cod_loja = $1 AND cod_secao = $2`;
    const params: any[] = [codLoja, codSecao];
    let idx = 3;

    if (codGrupo) {
      sql += ` AND cod_grupo = $${idx++}`;
      params.push(codGrupo);
    }
    if (codSubGrupo) {
      sql += ` AND cod_subgrupo = $${idx++}`;
      params.push(codSubGrupo);
    }
    if (codSegmento) {
      sql += ` AND cod_segmento = $${idx++}`;
      params.push(codSegmento);
    }

    return AppDataSource.query(sql, params);
  }

  /**
   * Salva regras de gap (UPSERT)
   */
  static async saveRegras(codLoja: number, regras: AncoragemRegra[]): Promise<void> {
    if (!regras || regras.length === 0) return;

    for (const r of regras) {
      await AppDataSource.query(
        `INSERT INTO ancoragem_regras (cod_loja, cod_secao, cod_grupo, cod_subgrupo, cod_segmento, tier, tipo_gap, valor_gap, tier_referencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (cod_loja, cod_secao, cod_grupo, cod_subgrupo, cod_segmento, tier) DO UPDATE SET
           tipo_gap = EXCLUDED.tipo_gap,
           valor_gap = EXCLUDED.valor_gap,
           tier_referencia = EXCLUDED.tier_referencia,
           updated_at = now()`,
        [codLoja, r.cod_secao, r.cod_grupo || 0, r.cod_subgrupo || 0, r.cod_segmento || 0, r.tier, r.tipo_gap, r.valor_gap, r.tier_referencia || 'Lider']
      );
    }

    console.log(`[Ancoragem] ${regras.length} regras salvas para loja ${codLoja}`);
  }

  /**
   * Busca tiers customizados do PostgreSQL
   */
  static async getCustomTiers(codLoja: number): Promise<any[]> {
    return AppDataSource.query(
      `SELECT * FROM ancoragem_tiers_custom WHERE cod_loja = $1 ORDER BY ordem`,
      [codLoja]
    );
  }

  /**
   * Salva tier customizado
   */
  static async saveCustomTier(codLoja: number, nome: string, ordem: number, cor: string): Promise<any> {
    const result = await AppDataSource.query(
      `INSERT INTO ancoragem_tiers_custom (cod_loja, nome, ordem, cor)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cod_loja, nome) DO UPDATE SET
         ordem = EXCLUDED.ordem,
         cor = EXCLUDED.cor
       RETURNING *`,
      [codLoja, nome, ordem, cor]
    );
    return result[0];
  }

  /**
   * Deleta tier customizado
   */
  static async deleteCustomTier(codLoja: number, nome: string): Promise<void> {
    await AppDataSource.query(
      `DELETE FROM ancoragem_tiers_custom WHERE cod_loja = $1 AND nome = $2`,
      [codLoja, nome]
    );
  }

  /**
   * Analise completa: produtos + classificacoes + regras -> calculo de precos sugeridos
   */
  static async getAnalise(
    codLoja: number,
    codSecao: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<any> {
    // Buscar dados em paralelo
    const [products, classificacoes, regras] = await Promise.all([
      this.getProducts(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
      this.getClassificacoes(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
      this.getRegras(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
    ]);

    // Mapear classificacoes por cod_produto
    const classMap = new Map<string, string>();
    for (const c of classificacoes) {
      classMap.set(String(c.cod_produto), c.tier);
    }

    // Mapear regras por tier
    const regraMap = new Map<string, { tipo_gap: string; valor_gap: number; tier_referencia: string }>();
    for (const r of regras) {
      regraMap.set(r.tier, { tipo_gap: r.tipo_gap, valor_gap: parseFloat(r.valor_gap), tier_referencia: r.tier_referencia });
    }

    // Encontrar preco ancora (media dos produtos "Lider")
    const liderProducts = products.filter(p => classMap.get(p.COD_PRODUTO) === 'Lider');
    const precoAncora = liderProducts.length > 0
      ? liderProducts.reduce((s, p) => s + p.PRECO_VENDA, 0) / liderProducts.length
      : 0;

    // Calcular analise para cada produto
    const rows = products.map(p => {
      const tier = classMap.get(p.COD_PRODUTO) || '';
      const regra = regraMap.get(tier);

      let precoSugerido = 0;
      let markdownAtual = 0;
      let custoIdeal = 0;
      let status = 'cinza'; // sem classificacao

      // Markdown = margem real = (VENDA - CUSTO) / VENDA * 100 (mesma formula da Gestao Inteligente)
      markdownAtual = p.PRECO_VENDA > 0 ? ((p.PRECO_VENDA - p.VAL_CUSTO) / p.PRECO_VENDA) * 100 : 0;

      if (tier && precoAncora > 0) {

        if (regra) {
          // Calcular preco sugerido
          if (regra.tipo_gap === '%') {
            precoSugerido = precoAncora * (1 + regra.valor_gap / 100);
          } else {
            precoSugerido = precoAncora + regra.valor_gap;
          }

          // Custo ideal = preco sugerido * (1 - margem_meta/100)
          custoIdeal = p.VAL_MARGEM > 0 ? precoSugerido * (1 - p.VAL_MARGEM / 100) : 0;

          // Status semaforo
          const diff = precoSugerido > 0 ? Math.abs((p.PRECO_VENDA - precoSugerido) / precoSugerido * 100) : 0;
          if (diff <= 2) status = 'verde';
          else if (diff <= 5) status = 'amarelo';
          else status = 'vermelho';
        } else {
          // Tem tier mas nao tem regra
          status = 'cinza';
        }
      }

      return {
        COD_PRODUTO: p.COD_PRODUTO,
        DESCRICAO: p.DESCRICAO,
        COD_BARRAS: p.COD_BARRAS,
        DES_SEGMENTO: p.DES_SEGMENTO,
        COD_MARCA: p.COD_MARCA,
        DES_MARCA: p.DES_MARCA,
        TIER: tier,
        PRECO_VENDA: p.PRECO_VENDA,
        VAL_CUSTO: p.VAL_CUSTO,
        VAL_MARGEM: p.VAL_MARGEM,
        CURVA: p.CURVA,
        CONC_BARATO: p.CONC_BARATO,
        CONC_NOME: p.CONC_NOME,
        VD_MEDIA: p.VD_MEDIA,
        PRECO_ANCORA: precoAncora,
        MARKDOWN_ATUAL: markdownAtual,
        PRECO_SUGERIDO: precoSugerido,
        CUSTO_IDEAL: custoIdeal,
        STATUS: status,
      };
    });

    return {
      rows,
      precoAncora,
      totalProdutos: products.length,
      totalClassificados: classificacoes.length,
      totalRegras: regras.length,
    };
  }
}
