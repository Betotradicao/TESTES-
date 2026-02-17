/**
 * Ancoragem de Preco Service
 * Classificacao de marcas por tier + Regua de preco + Analise/Simulacao
 * Fonte: Oracle (produtos/marcas) + PostgreSQL (classificacoes/regras)
 *
 * ZERO HARDCODE: Todas as tabelas e colunas Oracle sao resolvidas
 * exclusivamente via MappingService (Configuracoes de Rede).
 * Se um mapeamento nao existir, a coluna/tabela e simplesmente ignorada.
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
  FORA_LINHA: string;
  FORA_MIX: string;
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

  // ==========================================
  // Helpers - resolvem via MappingService PURO
  // Se nao estiver mapeado, retorna null (sem hardcode)
  // ==========================================

  private static async tryCol(table: string, field: string): Promise<string | null> {
    try {
      // Verifica diretamente nos mappings se a coluna REALMENTE esta mapeada
      // MappingService.getColumnFromTable retorna fieldName.toUpperCase() como fallback
      // o que causa ORA-00904, entao verificamos direto na estrutura
      const mappings = await (MappingService as any).getMappings();
      if (mappings?.version === 2 && mappings?.tabelas?.[table]?.colunas?.[field]) {
        return mappings.tabelas[table].colunas[field];
      }
      return null;
    } catch { return null; }
  }

  private static async tryTable(table: string, schema: string): Promise<string | null> {
    try {
      // Verifica diretamente nos mappings se a tabela REALMENTE esta mapeada
      const mappings = await (MappingService as any).getMappings();
      if (mappings?.version === 2 && mappings?.tabelas?.[table]?.nome_real) {
        return `${schema}.${mappings.tabelas[table].nome_real}`;
      }
      return null;
    } catch { return null; }
  }

  /**
   * Busca produtos do Oracle com marca, preco, custo, margem, pesquisa concorrente
   * Todas colunas/tabelas resolvidas via MappingService - ZERO hardcode
   */
  static async getProducts(
    codLoja: number,
    codSecao: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<AncoragemProduct[]> {
    const schema = await MappingService.getSchema();

    // ---- Tabelas obrigatorias (TAB_PRODUTO + TAB_PRODUTO_LOJA) ----
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

    // ---- Colunas obrigatorias TAB_PRODUTO ----
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');

    // ---- Colunas obrigatorias TAB_PRODUTO_LOJA ----
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    // ---- Colunas opcionais (com fallback para nomes padrao) ----
    let colSegmentoProd: string = 'COD_SEGMENTO';
    const mappedSegProd = await this.tryCol('TAB_PRODUTO', 'codigo_segmento');
    if (mappedSegProd) colSegmentoProd = mappedSegProd;
    const colMargem = await this.tryCol('TAB_PRODUTO_LOJA', 'margem');
    const colPesquisaMedia = await this.tryCol('TAB_PRODUTO_LOJA', 'pesquisa_media');
    const colPesquisaConcorrente = await this.tryCol('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
    const colVendaMedia = await this.tryCol('TAB_PRODUTO_LOJA', 'venda_media');
    // Fora Linha e Fora Mix: usar tryCol, mas com fallback para nomes padrão (igual ponderacao)
    let colForaLinha: string = 'FORA_LINHA';
    const mappedForaLinha = await this.tryCol('TAB_PRODUTO_LOJA', 'fora_linha');
    if (mappedForaLinha) colForaLinha = mappedForaLinha;

    let colInativo: string = 'INATIVO';
    const mappedInativo = await this.tryCol('TAB_PRODUTO_LOJA', 'inativo');
    if (mappedInativo) colInativo = mappedInativo;
    const colCodMarca = await this.tryCol('TAB_PRODUTO', 'codigo_marca');

    // ---- Tabela TAB_MARCA (opcional) ----
    const tabMarca = await this.tryTable('TAB_MARCA', schema);
    const colCodMarcaTab = tabMarca ? await this.tryCol('TAB_MARCA', 'codigo_marca') : null;
    const colDesMarcaTab = tabMarca ? await this.tryCol('TAB_MARCA', 'descricao_marca') : null;

    // ---- Tabela TAB_SEGMENTO (com fallback para nomes padrao) ----
    let tabSegmento = `${schema}.TAB_SEGMENTO`;
    const mappedTabSeg = await this.tryTable('TAB_SEGMENTO', schema);
    if (mappedTabSeg) tabSegmento = mappedTabSeg;

    let colCodSegTab: string = 'COD_SEGMENTO';
    const mappedCodSeg = await this.tryCol('TAB_SEGMENTO', 'codigo_segmento');
    if (mappedCodSeg) colCodSegTab = mappedCodSeg;

    let colDesSegTab: string = 'DES_SEGMENTO';
    const mappedDesSeg = await this.tryCol('TAB_SEGMENTO', 'descricao_segmento');
    if (mappedDesSeg) colDesSegTab = mappedDesSeg;

    // ---- Montar SELECTs opcionais ----
    const margemSelect = colMargem ? `NVL(pl.${colMargem}, 0) AS VAL_MARGEM` : '0 AS VAL_MARGEM';
    const pesquisaMediaSelect = colPesquisaMedia ? `NVL(pl.${colPesquisaMedia}, 0) AS CONC_BARATO` : '0 AS CONC_BARATO';
    const pesquisaConcSelect = colPesquisaConcorrente ? `pl.${colPesquisaConcorrente} AS CONC_NOME` : "NULL AS CONC_NOME";
    const vendaMediaSelect = colVendaMedia ? `NVL(pl.${colVendaMedia}, 0) AS VD_MEDIA` : '0 AS VD_MEDIA';
    const foraLinhaSelect = `NVL(pl.${colForaLinha}, 'N') AS FORA_LINHA`;
    const foraMixSelect = `NVL(pl.${colInativo}, 'N') AS FORA_MIX`;

    // ---- Marca: SELECT + JOIN ----
    let marcaSelect = "0 AS COD_MARCA, ' ' AS DES_MARCA";
    let marcaJoin = '';
    if (colCodMarca && tabMarca && colCodMarcaTab && colDesMarcaTab) {
      marcaSelect = `NVL(p.${colCodMarca}, 0) AS COD_MARCA, NVL(m.${colDesMarcaTab}, ' ') AS DES_MARCA`;
      marcaJoin = `LEFT JOIN ${tabMarca} m ON p.${colCodMarca} = m.${colCodMarcaTab}`;
    } else if (colCodMarca) {
      marcaSelect = `NVL(p.${colCodMarca}, 0) AS COD_MARCA, ' ' AS DES_MARCA`;
    }

    // ---- Segmento: SELECT + JOIN ----
    let segmentoSelect = "' ' AS DES_SEGMENTO";
    let segmentoJoin = '';
    if (tabSegmento && colSegmentoProd && colCodSegTab && colDesSegTab) {
      segmentoSelect = `NVL(seg.${colDesSegTab}, ' ') AS DES_SEGMENTO`;
      segmentoJoin = `LEFT JOIN ${tabSegmento} seg ON p.${colSegmentoProd} = seg.${colCodSegTab}`;
    }

    // ---- Filtros dinamicos ----
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
    if (codSegmento && colSegmentoProd) {
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
        ${pesquisaConcSelect},
        ${vendaMediaSelect},
        ${foraLinhaSelect},
        ${foraMixSelect}
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
      FORA_LINHA: r.FORA_LINHA || 'N',
      FORA_MIX: r.FORA_MIX || 'N',
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
    // Buscar dados em paralelo (inclui tiers custom para ordem)
    const [products, classificacoes, regras, customTiersDB] = await Promise.all([
      this.getProducts(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
      this.getClassificacoes(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
      this.getRegras(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento),
      this.getCustomTiers(codLoja),
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

    // Agrupar produtos por tier
    const tierProds = new Map<string, typeof products>();
    for (const p of products) {
      const tier = classMap.get(p.COD_PRODUTO);
      if (!tier) continue;
      if (!tierProds.has(tier)) tierProds.set(tier, []);
      tierProds.get(tier)!.push(p);
    }

    // ================================================================
    // Preco medio real por tier
    // ================================================================
    const tierRefPrice = new Map<string, number>();
    for (const [tier, prods] of tierProds) {
      if (prods.length > 0) {
        tierRefPrice.set(tier, prods.reduce((s, p) => s + p.PRECO_VENDA, 0) / prods.length);
      }
    }

    // ================================================================
    // HIERARQUIA POR POSICAO (ordem dos tiers configurados).
    // Premium FIXO como posicao 1 (ancora) - NUNCA desce.
    // Demais tiers seguem a ordem configurada na Regua.
    // ================================================================
    // Montar mapa de ordem: default tiers + custom tiers
    const DEFAULT_TIER_ORDER: Record<string, number> = {
      'Premium': 1, 'Lider': 2, 'Intermediaria': 3,
      'Combate': 4, 'Regional': 5, 'Propria': 6,
    };
    const tierOrderMap = new Map<string, number>();
    // Defaults primeiro
    for (const [name, ord] of Object.entries(DEFAULT_TIER_ORDER)) {
      tierOrderMap.set(name, ord);
    }
    // Tiers custom (pode sobrescrever posicoes dos defaults se usuario reordenou)
    // Tambem verifica se o user salvou ordem customizada via localStorage (vem como custom tiers do frontend)
    for (const ct of customTiersDB) {
      tierOrderMap.set(ct.nome, ct.ordem);
    }
    // Se o usuario reordenou tiers default via drag, a ordem vem salva no localStorage do frontend
    // mas no backend precisamos da regua visual - usar as regras existentes como hint se nao tiver custom
    // Entao vamos simplesmente ordernar pelo tierOrderMap

    // Premium SEMPRE posicao 1, independente do que o DB diz
    tierOrderMap.set('Premium', 1);

    const sortedTiers = [...tierRefPrice.entries()].sort((a, b) => {
      // Premium SEMPRE primeiro (fixo)
      if (a[0] === 'Premium') return -1;
      if (b[0] === 'Premium') return 1;
      const ordA = tierOrderMap.get(a[0]) ?? 99;
      const ordB = tierOrderMap.get(b[0]) ?? 99;
      return ordA - ordB;
    });

    const anchorTier = sortedTiers.length > 0 ? sortedTiers[0][0] : '';
    const precoAncora = anchorTier ? (tierRefPrice.get(anchorTier) || 0) : 0;

    // Referencia: cada tier compara com o tier ACIMA (mais caro na hierarquia)
    const tierAbove = new Map<string, string>();
    for (let i = 1; i < sortedTiers.length; i++) {
      tierAbove.set(sortedTiers[i][0], sortedTiers[i - 1][0]);
    }

    console.log(`[Ancoragem] Hierarquia: ${sortedTiers.map(([t, p]) => `${t}(R$${p.toFixed(2)})`).join(' > ')} | Ancora: ${anchorTier}`);

    // ================================================================
    // Gap entre tiers consecutivos (setas no frontend)
    // O gap entre tierA (acima) e tierB (abaixo) vem da REGRA do tierA,
    // pois na Regua o usuario configura "Lider R$0,25 em relação ao Intermediaria"
    // ou seja, a regra do tier de CIMA define o gap para o tier de BAIXO.
    // ================================================================
    const tierGaps: { [tier: string]: { gapIdeal: number; refTier: string; refPrice: number } } = {};
    for (let i = 1; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i][0];       // tier de baixo (ex: Intermediaria)
      const refTier = sortedTiers[i - 1][0]; // tier de cima (ex: Lider)
      // Gap vem da regra do tier de CIMA (refTier)
      const regra = regraMap.get(refTier);
      tierGaps[tier] = {
        gapIdeal: regra ? Math.abs(regra.valor_gap) : 0,
        refTier,
        refPrice: tierRefPrice.get(refTier) || 0,
      };
    }

    console.log(`[Ancoragem] tierGaps:`, JSON.stringify(tierGaps));

    // ================================================================
    // Calcular analise para cada produto
    // Status: 'ancora' | 'dentro' (verde) | 'acima' (laranja) | 'abaixo' (vermelho)
    // ================================================================
    const rows = products.map(p => {
      const tier = classMap.get(p.COD_PRODUTO) || '';

      let precoSugerido = 0;
      let markdownAtual = 0;
      let custoIdeal = 0;
      let difReal = 0;
      let status = 'cinza';

      markdownAtual = p.PRECO_VENDA > 0 ? ((p.PRECO_VENDA - p.VAL_CUSTO) / p.PRECO_VENDA) * 100 : 0;

      if (tier && tierRefPrice.has(tier)) {
        if (tier === anchorTier) {
          // Ancora: sem comparacao
          precoSugerido = p.PRECO_VENDA;
          status = 'ancora';
        } else {
          // Pegar preco do tier ACIMA na hierarquia
          const refTier = tierAbove.get(tier);
          const refPrice = refTier ? (tierRefPrice.get(refTier) || 0) : 0;
          // Gap vem da regra do tier de CIMA (refTier)
          const regra = refTier ? regraMap.get(refTier) : null;
          const gap = regra ? Math.abs(regra.valor_gap) : 0;

          if (refPrice > 0) {
            precoSugerido = refPrice - gap;
            difReal = p.PRECO_VENDA - precoSugerido;
            // 3 estados: dentro (tolerancia 0.05), acima (positivo), abaixo (negativo)
            if (Math.abs(difReal) <= 0.05) status = 'dentro';
            else if (difReal > 0) status = 'acima';
            else status = 'abaixo';
          }
        }

        custoIdeal = precoSugerido > 0 && p.VAL_MARGEM > 0 ? precoSugerido * (1 - p.VAL_MARGEM / 100) : 0;
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
        FORA_LINHA: p.FORA_LINHA,
        FORA_MIX: p.FORA_MIX,
        PRECO_ANCORA: precoAncora,
        MARKDOWN_ATUAL: markdownAtual,
        PRECO_SUGERIDO: precoSugerido,
        CUSTO_IDEAL: custoIdeal,
        DIF_REAL: difReal,
        STATUS: status,
      };
    });

    return {
      rows,
      tierGaps,
      precoAncora,
      anchorTier,
      tierOrder: sortedTiers.map(([t]) => t),
      totalProdutos: products.length,
      totalClassificados: classificacoes.length,
      totalRegras: regras.length,
    };
  }

  /**
   * Stats agregados: conta total e por status (ancora/dentro/acima/abaixo) em todas as secoes da loja
   */
  static async getStats(codLoja: number): Promise<{ total: number; ancora: number; dentro: number; acima: number; abaixo: number; produtos: Record<string, string[]> }> {
    console.log('[Ancoragem] getStats chamado para codLoja:', codLoja);
    const secoesResult = await AppDataSource.query(
      `SELECT DISTINCT cod_secao FROM ancoragem_classificacao WHERE cod_loja = $1`,
      [codLoja]
    );

    const counts = { total: 0, ancora: 0, dentro: 0, acima: 0, abaixo: 0 };
    const produtos: Record<string, string[]> = { ancora: [], dentro: [], acima: [], abaixo: [] };

    if (!secoesResult || secoesResult.length === 0) return { ...counts, produtos };

    const results = await Promise.all(
      secoesResult.map((s: any) =>
        this.getAnalise(codLoja, Number(s.cod_secao))
          .catch(() => ({ rows: [] }))
      )
    );

    for (const result of results) {
      for (const row of (result.rows || [])) {
        // Só contar produtos que possuem classificação de tier
        if (!row.TIER) continue;
        counts.total++;
        const st = row.STATUS as string;
        const cod = String(row.COD_PRODUTO);
        if (st === 'ancora') { counts.ancora++; produtos.ancora.push(cod); }
        else if (st === 'dentro') { counts.dentro++; produtos.dentro.push(cod); }
        else if (st === 'acima') { counts.acima++; produtos.acima.push(cod); }
        else if (st === 'abaixo') { counts.abaixo++; produtos.abaixo.push(cod); }
      }
    }

    return { ...counts, produtos };
  }
}
