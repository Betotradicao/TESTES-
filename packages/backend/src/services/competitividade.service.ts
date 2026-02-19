import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';

interface CompetitividadeFilters {
  codLoja: string;
  codSecao?: string;
  codGrupo?: string;
  concorrente?: string; // filtrar por concorrente específico
}

interface CompetitividadeRow {
  COD_PRODUTO: string;
  COD_BARRAS: string;
  DESCRICAO: string;
  SECAO: string;
  CURVA: string;
  PRECO_VENDA: number;
  PRECO_CUSTO: number;
  CONC_PRECO: number;
  CONC_NOME: string;
  DIFERENCA_RS: number;
  DIFERENCA_PCT: number;
  ESTOQUE: number;
  VD_MEDIA: number;
  MARGEM_PCT: number;
  RELEVANCIA: string; // N=Notavel, SP=Sensivel a Preco, R=Restante, -=Nao classificado
  DTA_PESQUISA: string | null;
}

export class CompetitividadeService {

  private static async tryCol(table: string, key: string): Promise<string | null> {
    try {
      return await MappingService.getColumnFromTable(table, key);
    } catch { return null; }
  }

  /**
   * Busca produtos com pesquisa de concorrente
   */
  static async getDados(filters: CompetitividadeFilters): Promise<{ rows: CompetitividadeRow[]; concorrentes: string[] }> {
    const schema = await MappingService.getSchema();

    // Resolver tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

    // Resolver colunas TAB_PRODUTO
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');

    // Resolver colunas TAB_PRODUTO_LOJA
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    // Colunas opcionais
    const colVendaMedia = await this.tryCol('TAB_PRODUTO_LOJA', 'venda_media');
    const vendaMediaSelect = colVendaMedia ? `NVL(pl.${colVendaMedia}, 0)` : '0';

    // Data da pesquisa de preço (sem mapping - nome Oracle fixo)
    const colDtaPesquisaMedia = 'DTA_PESQUISA_MEDIA';

    // Pesquisa concorrente
    let colPesquisaMedia = 'VAL_PESQUISA_MEDIA';
    let colPesquisaConcorrente = 'DES_PESQUISA_CONCORRENTE';
    let hasPesquisaMedia = false;
    let hasPesquisaConcorrente = false;

    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
      console.log('[Competitividade] pesquisa_media mapped =>', mapped);
      if (mapped) colPesquisaMedia = mapped;
    } catch (e: any) {
      console.log('[Competitividade] pesquisa_media mapping error:', e.message);
    }

    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
      console.log('[Competitividade] pesquisa_concorrente mapped =>', mapped);
      if (mapped) colPesquisaConcorrente = mapped;
    } catch (e: any) {
      console.log('[Competitividade] pesquisa_concorrente mapping error:', e.message);
    }

    console.log(`[Competitividade] Usando colunas: pesquisaMedia=${colPesquisaMedia}, pesquisaConcorrente=${colPesquisaConcorrente}`);

    // Verificar se colunas existem
    const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
    console.log(`[Competitividade] schema=${schema}, tblName=${tblName}`);

    try {
      const checkSql1 = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE UPPER(OWNER) = UPPER('${schema.replace(/"/g, '')}') AND UPPER(TABLE_NAME) = UPPER('${tblName}') AND UPPER(COLUMN_NAME) = UPPER('${colPesquisaMedia.replace(/"/g, '')}')`;
      console.log('[Competitividade] Check1 SQL:', checkSql1);
      const check1 = await OracleService.query<any>(checkSql1);
      console.log('[Competitividade] Check1 result:', check1.length, 'rows');
      hasPesquisaMedia = check1.length > 0;
    } catch (e: any) {
      console.log('[Competitividade] Check1 error:', e.message);
    }
    try {
      const checkSql2 = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE UPPER(OWNER) = UPPER('${schema.replace(/"/g, '')}') AND UPPER(TABLE_NAME) = UPPER('${tblName}') AND UPPER(COLUMN_NAME) = UPPER('${colPesquisaConcorrente.replace(/"/g, '')}')`;
      const check2 = await OracleService.query<any>(checkSql2);
      console.log('[Competitividade] Check2 result:', check2.length, 'rows');
      hasPesquisaConcorrente = check2.length > 0;
    } catch (e: any) {
      console.log('[Competitividade] Check2 error:', e.message);
    }

    if (!hasPesquisaMedia) {
      console.log('[Competitividade] Coluna de pesquisa de preço não encontrada - retornando vazio');
      return { rows: [], concorrentes: [] };
    }

    const pesquisaMediaSel = `NVL(pl.${colPesquisaMedia}, 0)`;
    const concorrenteSel = hasPesquisaConcorrente ? `pl.${colPesquisaConcorrente}` : "' '";

    // Seção (tabela)
    let tabSecao = `${schema}.TAB_SECAO`;
    let colCodSecaoTab = 'COD_SECAO';
    let colDesSecaoTab = 'DES_SECAO';
    try {
      const mapped = await MappingService.getRealTableName('TAB_SECAO');
      if (mapped) tabSecao = `${schema}.${mapped}`;
    } catch {}
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      if (mapped) colCodSecaoTab = mapped;
    } catch {}
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
      if (mapped) colDesSecaoTab = mapped;
    } catch {}

    // Relevancia (TIPO_RELEVANCIA: 0=N, 1=SP, 2=R)
    let hasRelevanciaCol = false;
    const colTipoRelevancia = 'TIPO_RELEVANCIA';
    try {
      const checkRelev = await OracleService.query<any>(`SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE UPPER(OWNER) = UPPER('${schema.replace(/"/g, '')}') AND UPPER(TABLE_NAME) = UPPER('${tblName}') AND COLUMN_NAME = '${colTipoRelevancia}'`);
      hasRelevanciaCol = checkRelev.length > 0;
    } catch {}
    const relevanciaSel = hasRelevanciaCol ? `NVL(pl.${colTipoRelevancia}, -1)` : '-1';

    // Fora Mix / Fora Linha
    let colForaLinha = 'FORA_LINHA';
    let colInativo = 'INATIVO';
    try { const m = await this.tryCol('TAB_PRODUTO_LOJA', 'fora_linha'); if (m) colForaLinha = m; } catch {}
    try { const m = await this.tryCol('TAB_PRODUTO_LOJA', 'inativo'); if (m) colInativo = m; } catch {}

    // Filtros
    let filtroSecao = '';
    let filtroGrupo = '';
    let filtroConcorrente = '';
    const params: any = { codLoja: filters.codLoja };

    if (filters.codSecao) {
      filtroSecao = `AND p.${colCodSecaoProd} = :codSecao`;
      params.codSecao = filters.codSecao;
    }
    if (filters.codGrupo) {
      filtroGrupo = `AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = filters.codGrupo;
    }
    if (filters.concorrente) {
      filtroConcorrente = `AND UPPER(${concorrenteSel}) LIKE :concorrente`;
      params.concorrente = `%${filters.concorrente.toUpperCase()}%`;
    }

    const sql = `
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colCodBarras} AS COD_BARRAS,
        p.${colDesProduto} AS DESCRICAO,
        NVL(s.${colDesSecaoTab}, ' ') AS SECAO,
        NVL(pl.${colCurva}, 'X') AS CURVA,
        NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
        NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
        ${pesquisaMediaSel} AS CONC_PRECO,
        ${concorrenteSel} AS CONC_NOME,
        NVL(pl.${colEstoqueAtual}, 0) AS ESTOQUE,
        ${vendaMediaSelect} AS VD_MEDIA,
        ${relevanciaSel} AS TIPO_RELEVANCIA,
        pl.${colDtaPesquisaMedia} AS DTA_PESQUISA
      FROM ${tabProduto} p
      JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja} AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoProd} = s.${colCodSecaoTab}
      WHERE ${pesquisaMediaSel} > 0
        AND NVL(pl.${colPrecoVenda}, 0) > 0
        AND NVL(pl.${colForaLinha}, 'N') = 'N'
        AND NVL(pl.${colInativo}, 'N') = 'N'
        ${filtroSecao}
        ${filtroGrupo}
        ${filtroConcorrente}
      ORDER BY CASE WHEN NVL(pl.${colPrecoVenda}, 0) > ${pesquisaMediaSel} THEN 0 ELSE 1 END,
               ABS(NVL(pl.${colPrecoVenda}, 0) - ${pesquisaMediaSel}) DESC
    `;

    console.log('[Competitividade] SQL:', sql.replace(/\s+/g, ' ').trim());
    console.log('[Competitividade] Params:', JSON.stringify(params));
    const results = await OracleService.query<any>(sql, params);
    console.log(`[Competitividade] ${results.length} produtos com pesquisa de concorrente`);

    const concorrentesSet = new Set<string>();

    const rows: CompetitividadeRow[] = results.map((r: any) => {
      const pv = Number(r.PRECO_VENDA) || 0;
      const cp = Number(r.CONC_PRECO) || 0;
      const pc = Number(r.PRECO_CUSTO) || 0;
      const difRS = pv - cp;
      const difPct = cp > 0 ? ((pv - cp) / cp) * 100 : 0;
      const margemPct = pv > 0 ? ((pv - pc) / pv) * 100 : 0;
      const nome = (r.CONC_NOME || '').trim();
      if (nome) concorrentesSet.add(nome);

      return {
        COD_PRODUTO: String(r.COD_PRODUTO),
        COD_BARRAS: r.COD_BARRAS || '',
        DESCRICAO: r.DESCRICAO || '',
        SECAO: r.SECAO || '',
        CURVA: r.CURVA || 'X',
        PRECO_VENDA: pv,
        PRECO_CUSTO: pc,
        CONC_PRECO: cp,
        CONC_NOME: nome,
        DIFERENCA_RS: Math.round(difRS * 100) / 100,
        DIFERENCA_PCT: Math.round(difPct * 100) / 100,
        ESTOQUE: Number(r.ESTOQUE) || 0,
        VD_MEDIA: Number(r.VD_MEDIA) || 0,
        MARGEM_PCT: Math.round(margemPct * 100) / 100,
        RELEVANCIA: r.TIPO_RELEVANCIA === 0 ? 'N' : r.TIPO_RELEVANCIA === 1 ? 'SP' : r.TIPO_RELEVANCIA === 2 ? 'R' : '-',
        DTA_PESQUISA: r.DTA_PESQUISA ? new Date(r.DTA_PESQUISA).toISOString().split('T')[0] : null,
      };
    });

    return { rows, concorrentes: [...concorrentesSet].sort() };
  }

  /**
   * Lista seções disponíveis
   */
  static async getSecoes(codLoja: string): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');

    let tabSecao = `${schema}.TAB_SECAO`;
    let colCodSecaoTab = 'COD_SECAO';
    let colDesSecaoTab = 'DES_SECAO';
    try { const m = await MappingService.getRealTableName('TAB_SECAO'); if (m) tabSecao = `${schema}.${m}`; } catch {}
    try { const m = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao'); if (m) colCodSecaoTab = m; } catch {}
    try { const m = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao'); if (m) colDesSecaoTab = m; } catch {}

    const sql = `
      SELECT DISTINCT p.${colCodSecaoProd} AS COD_SECAO, s.${colDesSecaoTab} AS DES_SECAO
      FROM ${tabProduto} p
      JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja} AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoProd} = s.${colCodSecaoTab}
      ORDER BY s.${colDesSecaoTab}
    `;
    return OracleService.query<any>(sql, { codLoja });
  }
}
