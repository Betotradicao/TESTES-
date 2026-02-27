/**
 * Prazo Fornecedores Service
 * Consulta fornecedores com suas últimas 10 NFs e parcelas de pagamento do fluxo financeiro
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface NotaComPrazo {
  NUM_NF_FORN: string;
  DTA_EMISSAO: string;
  DTA_ENTRADA: string;
  VAL_TOTAL_NF: number;
  PRAZO: string;       // "7/14/21"
  PRAZO_MEDIO_NF: number;
  FORMA_PGTO: string;  // "BOLETO", "CARTAO", etc
  TIPO_NF: string;     // "REVENDA", "BONIFICAÇÃO", "OUTROS"
}

export interface FornecedorPrazo {
  COD_FORNECEDOR: number;
  DES_FANTASIA: string;
  DES_FORNECEDOR: string;
  NUM_CGC: string;
  COND_PGTO_SISTEMA: number;
  PRAZO_MEDIO: number;
  QTD_NFS: number;
  VAL_TOTAL: number;
  DTA_ENTRADA_RECENTE: string;
  notas: NotaComPrazo[];
}

export class PrazoFornecedoresService {

  /**
   * Busca fornecedores com últimas 10 NFs e prazos reais de pagamento
   * Usa JOIN entre TAB_FORNECEDOR_NOTA e TAB_FLUXO por COD_FORNECEDOR + DTA_EMISSAO
   * TAB_FLUXO: TIPO_CONTA = 0 (contas a pagar), TIPO_PARCEIRO = 1 (fornecedor)
   */
  static async listarFornecedoresComPrazo(codLoja?: number, dataInicio?: string, dataFim?: string): Promise<FornecedorPrazo[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const tabFluxo = `${schema}.${await MappingService.getRealTableName('TAB_FLUXO')}`;

    // Tentar buscar tabela de entidades para descrição da forma de pagamento
    let tabEntidade = '';
    try {
      tabEntidade = `${schema}.${await MappingService.getRealTableName('TAB_ENTIDADE')}`;
    } catch {
      // Se não existir no mapping, tenta direto
      tabEntidade = `${schema}.TAB_ENTIDADE`;
    }

    const params: any = {};
    let lojaFilterNota = '';
    let dateFilter = '';

    if (codLoja) {
      lojaFilterNota = 'AND fn.COD_LOJA = :codLoja';
      params.codLoja = codLoja;
    }

    // Filtro de data: usa dataInicio/dataFim ou padrão 180 dias
    if (dataInicio && dataFim) {
      dateFilter = "AND fn.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND fn.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 1";
      params.dataInicio = dataInicio;
      params.dataFim = dataFim;
    } else {
      dateFilter = 'AND fn.DTA_ENTRADA >= SYSDATE - 180';
    }

    // Query única: Notas com parcelas de pagamento via JOIN
    // JOIN por COD_FORNECEDOR + DTA_EMISSAO (TRUNC) + VAL_TOTAL_NF
    // TAB_FLUXO: TIPO_CONTA = 0 = contas a pagar, TIPO_PARCEIRO = 1 = fornecedor
    const query = `
      SELECT * FROM (
        SELECT
          fn.COD_FORNECEDOR,
          NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
          f.DES_FORNECEDOR,
          f.NUM_CGC,
          NVL(f.NUM_MED_CPGTO, 0) as COND_PGTO_SISTEMA,
          fn.NUM_NF_FORN,
          TO_CHAR(fn.DTA_EMISSAO, 'DD/MM/YYYY') as DTA_EMISSAO_FMT,
          TO_CHAR(fn.DTA_ENTRADA, 'DD/MM/YYYY') as DTA_ENTRADA_FMT,
          NVL(fn.VAL_TOTAL_NF, 0) as VAL_TOTAL_NF,
          flx.DTA_VENCIMENTO as FLX_DTA_VENCIMENTO,
          flx.DTA_EMISSAO as FLX_DTA_EMISSAO,
          NVL(flx.VAL_PARCELA, 0) as FLX_VAL_PARCELA,
          flx.NUM_PARCELA as FLX_NUM_PARCELA,
          flx.QTD_PARCELA as FLX_QTD_PARCELA,
          NVL(ent.DES_ENTIDADE,
            CASE flx.COD_ENTIDADE
              WHEN 1 THEN 'DINHEIRO'
              WHEN 2 THEN 'CHEQUE'
              WHEN 3 THEN 'CARTAO'
              WHEN 8 THEN 'BOLETO'
              ELSE TO_CHAR(flx.COD_ENTIDADE)
            END
          ) as FORMA_PGTO,
          CASE WHEN flx.DTA_VENCIMENTO IS NOT NULL AND flx.DTA_EMISSAO IS NOT NULL
            THEN TRUNC(flx.DTA_VENCIMENTO) - TRUNC(flx.DTA_EMISSAO)
            ELSE NULL
          END as DIAS_PARCELA,
          ROW_NUMBER() OVER (
            PARTITION BY fn.COD_FORNECEDOR, fn.NUM_NF_FORN, flx.NUM_PARCELA
            ORDER BY fn.DTA_ENTRADA DESC
          ) as RN_DEDUP
        FROM ${tabFornecedorNota} fn
        JOIN ${tabFornecedor} f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
        LEFT JOIN ${tabFluxo} flx
          ON flx.COD_PARCEIRO = fn.COD_FORNECEDOR
          AND TRUNC(flx.DTA_EMISSAO) = TRUNC(fn.DTA_EMISSAO)
          AND ABS(NVL(flx.VAL_TOTAL_NF, 0) - NVL(fn.VAL_TOTAL_NF, 0)) < 1
          AND flx.TIPO_CONTA = 0
          AND flx.TIPO_PARCEIRO = 1
        LEFT JOIN ${tabEntidade} ent ON ent.COD_ENTIDADE = flx.COD_ENTIDADE
        WHERE NVL(fn.FLG_CANCELADO, 'N') = 'N'
        ${dateFilter}
        ${lojaFilterNota}
      ) WHERE RN_DEDUP = 1
      ORDER BY DES_FANTASIA, COD_FORNECEDOR, NUM_NF_FORN, FLX_NUM_PARCELA
    `;

    const rows = await OracleService.query(query, params);
    console.log(`[PrazoFornecedores] ${rows.length} rows retornados (notas + parcelas)`);

    // Buscar CFOP predominante por NF (para classificar tipo: Revenda/Bonificação/Outros)
    const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
    let colCfop = 'CFOP';
    try { colCfop = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'cfop'); } catch { /* fallback */ }
    const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
    const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

    // Coletar pares únicos fornecedor+NF
    const nfPairs = new Set<string>();
    for (const row of rows as any[]) {
      nfPairs.add(`${row.COD_FORNECEDOR}|${row.NUM_NF_FORN}`);
    }

    // Buscar CFOPs em batch (até 500 NFs por vez)
    const cfopMap = new Map<string, string>(); // "cod|nf" -> "REVENDA" | "BONIFICAÇÃO" | "OUTROS"
    const CFOP_REVENDA = ['1101','1102','2101','2102','1401','1403','2403'];
    const CFOP_BONIF = ['1910','2910','1411','2411','5910','6910','5911','6911','9505'];

    const classifCfop = (cfop: string): string => {
      const trimmed = (cfop || '').trim();
      if (CFOP_REVENDA.includes(trimmed)) return 'REVENDA';
      if (CFOP_BONIF.includes(trimmed)) return 'BONIFICAÇÃO';
      return 'OUTROS';
    };

    if (nfPairs.size > 0 && nfPairs.size <= 5000) {
      try {
        // Query todos os CFOPs de todas as NFs do período
        const cfopParams: any = {};
        if (codLoja) {
          cfopParams.codLoja = codLoja;
        }

        const cfopDateFilter = dataInicio && dataFim
          ? `AND fn2.DTA_ENTRADA >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND fn2.DTA_ENTRADA <= TO_DATE('${dataFim}', 'YYYY-MM-DD') + 1`
          : 'AND fn2.DTA_ENTRADA >= SYSDATE - 180';

        const cfopQuery = `
          SELECT fp.${nfCodFornecedorCol} as COD_FORN, fp.${nfNumeroNfCol} as NUM_NF, TRIM(fp.${colCfop}) as CFOP_VAL, COUNT(*) as QTD
          FROM ${tabFornecedorProduto} fp
          JOIN ${tabFornecedorNota} fn2 ON fn2.COD_FORNECEDOR = fp.${nfCodFornecedorCol} AND fn2.NUM_NF_FORN = fp.${nfNumeroNfCol}
          WHERE NVL(fn2.FLG_CANCELADO, 'N') = 'N'
          ${cfopDateFilter}
          ${codLoja ? 'AND fn2.COD_LOJA = :codLoja' : ''}
          AND fp.${colCfop} IS NOT NULL
          GROUP BY fp.${nfCodFornecedorCol}, fp.${nfNumeroNfCol}, TRIM(fp.${colCfop})
          ORDER BY fp.${nfCodFornecedorCol}, fp.${nfNumeroNfCol}, QTD DESC
        `;

        const cfopRows = await OracleService.query(cfopQuery, cfopParams);
        console.log(`[PrazoFornecedores] ${cfopRows.length} rows CFOP`);

        // Para cada NF, pegar o CFOP com maior contagem
        for (const cr of cfopRows as any[]) {
          const key = `${cr.COD_FORN}|${cr.NUM_NF}`;
          if (!cfopMap.has(key)) {
            cfopMap.set(key, classifCfop(cr.CFOP_VAL));
          }
        }
      } catch (err: any) {
        console.warn(`[PrazoFornecedores] Erro ao buscar CFOP: ${err.message}`);
      }
    }

    // Agrupar: fornecedor → NF → parcelas
    const fornecedorMap = new Map<number, FornecedorPrazo>();
    // Track NFs por fornecedor para manter apenas 10 mais recentes
    const fornNfMap = new Map<number, Map<string, { nota: any, parcelas: number[], formaPgto: string }>>();

    for (const row of rows as any[]) {
      const cod = row.COD_FORNECEDOR;
      const nfKey = String(row.NUM_NF_FORN);

      if (!fornecedorMap.has(cod)) {
        fornecedorMap.set(cod, {
          COD_FORNECEDOR: cod,
          DES_FANTASIA: row.DES_FANTASIA,
          DES_FORNECEDOR: row.DES_FORNECEDOR,
          NUM_CGC: row.NUM_CGC || '',
          COND_PGTO_SISTEMA: Number(row.COND_PGTO_SISTEMA) || 0,
          PRAZO_MEDIO: 0,
          QTD_NFS: 0,
          VAL_TOTAL: 0,
          DTA_ENTRADA_RECENTE: row.DTA_ENTRADA_FMT || '',
          notas: [],
        });
        fornNfMap.set(cod, new Map());
      }

      const nfMap = fornNfMap.get(cod)!;

      if (!nfMap.has(nfKey)) {
        nfMap.set(nfKey, {
          nota: row,
          parcelas: [],
          formaPgto: row.FORMA_PGTO || '',
        });
      }

      // Adicionar parcela se existe
      if (row.DIAS_PARCELA != null && row.DIAS_PARCELA >= 0) {
        nfMap.get(nfKey)!.parcelas.push(Number(row.DIAS_PARCELA));
      }
    }

    // Montar resultado
    for (const [cod, nfMap] of fornNfMap.entries()) {
      const forn = fornecedorMap.get(cod)!;

      // Ordenar NFs por DTA_ENTRADA desc (todas do período filtrado)
      const nfEntries = Array.from(nfMap.entries())
        .sort((a, b) => {
          const dateA = a[1].nota.DTA_ENTRADA_FMT || '';
          const dateB = b[1].nota.DTA_ENTRADA_FMT || '';
          // Parse DD/MM/YYYY para comparar
          const parseDate = (str: string) => {
            if (!str) return 0;
            const [d, m, y] = str.split('/');
            return new Date(`${y}-${m}-${d}`).getTime() || 0;
          };
          return parseDate(dateB) - parseDate(dateA);
        });

      // Atualizar DTA_ENTRADA_RECENTE com a primeira (mais recente)
      if (nfEntries.length > 0) {
        forn.DTA_ENTRADA_RECENTE = nfEntries[0][1].nota.DTA_ENTRADA_FMT || '';
      }

      for (const [, { nota, parcelas, formaPgto }] of nfEntries) {
        parcelas.sort((a, b) => a - b);
        // Remover duplicatas de parcelas
        const uniqueParcelas = [...new Set(parcelas)];

        const prazoStr = uniqueParcelas.length > 0 ? uniqueParcelas.join('/') : '-';
        const prazoMedioNf = uniqueParcelas.length > 0
          ? uniqueParcelas.reduce((s, d) => s + d, 0) / uniqueParcelas.length
          : 0;

        const cfopKey = `${cod}|${nota.NUM_NF_FORN}`;
        forn.notas.push({
          NUM_NF_FORN: nota.NUM_NF_FORN,
          DTA_EMISSAO: nota.DTA_EMISSAO_FMT,
          DTA_ENTRADA: nota.DTA_ENTRADA_FMT,
          VAL_TOTAL_NF: Number(nota.VAL_TOTAL_NF),
          PRAZO: prazoStr,
          PRAZO_MEDIO_NF: Math.round(prazoMedioNf * 10) / 10,
          FORMA_PGTO: formaPgto,
          TIPO_NF: cfopMap.get(cfopKey) || '',
        });

        forn.QTD_NFS++;
        forn.VAL_TOTAL += Number(nota.VAL_TOTAL_NF);
      }

      // Calcular prazo médio geral
      const notasComPrazo = forn.notas.filter(n => n.PRAZO !== '-');
      if (notasComPrazo.length > 0) {
        const somaMedias = notasComPrazo.reduce((s, n) => s + n.PRAZO_MEDIO_NF, 0);
        forn.PRAZO_MEDIO = Math.round((somaMedias / notasComPrazo.length) * 10) / 10;
      }
      forn.VAL_TOTAL = Math.round(forn.VAL_TOTAL * 100) / 100;
    }

    // Ordenar por nome fantasia
    return Array.from(fornecedorMap.values()).sort((a, b) =>
      a.DES_FANTASIA.localeCompare(b.DES_FANTASIA)
    );
  }

  /**
   * Busca itens (produtos) de uma nota fiscal de fornecedor
   * Usa TAB_FORNECEDOR_PRODUTO (mesma tabela da tela de Pedidos)
   */
  static async buscarItensNota(codFornecedor: number, numNf: string, codLoja?: number, prazoAtual?: number, mesesHistorico?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

    // Mapeamentos dinâmicos
    const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
    const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

    const numNfNum = Number(numNf) || 0;
    const params: any = { codFornecedor, numNf: numNfNum };

    console.log(`[PrazoFornecedores] Buscando itens: forn=${codFornecedor}, nf=${numNfNum}, loja=${codLoja || 'todas'}`);

    const query = `
      SELECT
        fp.COD_PRODUTO,
        pr.${prDesProdutoCol} as DES_PRODUTO,
        fp.QTD_ENTRADA,
        fp.DES_UNIDADE,
        NVL(fp.VAL_TABELA, 0) as VAL_CUSTO,
        (fp.QTD_ENTRADA * NVL(fp.VAL_TABELA, 0)) as VAL_TOTAL
      FROM ${tabFornecedorProduto} fp
      LEFT JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = fp.COD_PRODUTO
      WHERE fp.${nfNumeroNfCol} = :numNf
      AND fp.${nfCodFornecedorCol} = :codFornecedor
      ORDER BY fp.NUM_ITEM
    `;

    const rows = await OracleService.query(query, params) as any[];
    console.log(`[PrazoFornecedores] Itens NF ${numNf} forn ${codFornecedor}: ${rows.length} itens`);

    // Verificar quais produtos têm fornecedores alternativos com prazo maior
    if (prazoAtual != null && prazoAtual >= 0 && rows.length > 0) {
      const diasHist = (mesesHistorico || 6) * 30;
      const codProdutos = rows.map((r: any) => Number(r.COD_PRODUTO)).filter(Boolean);

      if (codProdutos.length > 0) {
        try {
          // Construir IN clause com binds numerados
          const inBinds: any = { codFornExcl: codFornecedor, prazoMin: prazoAtual, diasHist };
          const inParts: string[] = [];
          codProdutos.forEach((cod: number, i: number) => {
            inBinds[`p${i}`] = cod;
            inParts.push(`:p${i}`);
          });

          let lojaFilterAlt = '';
          if (codLoja) {
            lojaFilterAlt = 'AND fn2.COD_LOJA = :codLojaAlt';
            inBinds.codLojaAlt = codLoja;
          }

          const altQuery = `
            SELECT DISTINCT fp2.COD_PRODUTO
            FROM ${tabFornecedorProduto} fp2
            JOIN ${tabFornecedor} f2 ON f2.COD_FORNECEDOR = fp2.${nfCodFornecedorCol}
            JOIN ${tabFornecedorNota} fn2 ON fn2.COD_FORNECEDOR = fp2.${nfCodFornecedorCol}
              AND fn2.NUM_NF_FORN = fp2.${nfNumeroNfCol}
            WHERE fp2.COD_PRODUTO IN (${inParts.join(',')})
            AND fp2.${nfCodFornecedorCol} <> :codFornExcl
            AND NVL(fn2.FLG_CANCELADO, 'N') = 'N'
            AND fn2.DTA_ENTRADA >= SYSDATE - :diasHist
            AND NVL(f2.NUM_MED_CPGTO, 0) > :prazoMin
            ${lojaFilterAlt}
          `;

          const altRows = await OracleService.query(altQuery, inBinds) as any[];
          const prodsComAlt = new Set(altRows.map((r: any) => Number(r.COD_PRODUTO)));

          for (const row of rows) {
            (row as any).TEM_ALTERNATIVO = prodsComAlt.has(Number((row as any).COD_PRODUTO));
          }

          console.log(`[PrazoFornecedores] Produtos com alternativa (prazo > ${prazoAtual}): ${prodsComAlt.size}/${codProdutos.length}`);
        } catch (err: any) {
          console.warn(`[PrazoFornecedores] Erro ao verificar alternativos: ${err.message}`);
          // Se falhar, não bloqueia - apenas não marca
        }
      }
    }

    return rows;
  }

  /**
   * Verifica quais fornecedores possuem pelo menos 1 produto
   * que outro fornecedor vende com prazo (NUM_MED_CPGTO) maior.
   * Retorna Set de COD_FORNECEDOR que têm "oportunidade de prazo".
   */
  static async verificarFornecedoresComMelhorPrazo(
    codLoja?: number,
    dataInicio?: string,
    dataFim?: string,
    mesesHistorico: number = 6
  ): Promise<Set<number>> {
    const schema = await MappingService.getSchema();
    const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
    const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

    const params: any = { diasHist: mesesHistorico * 30 };
    let lojaFilter1 = '';
    let lojaFilter2 = '';
    let dateFilter = '';

    if (codLoja) {
      lojaFilter1 = 'AND fn1.COD_LOJA = :codLoja';
      lojaFilter2 = 'AND fn2.COD_LOJA = :codLoja';
      params.codLoja = codLoja;
    }

    if (dataInicio && dataFim) {
      dateFilter = "AND fn1.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND fn1.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 1";
      params.dataInicio = dataInicio;
      params.dataFim = dataFim;
    } else {
      dateFilter = 'AND fn1.DTA_ENTRADA >= SYSDATE - 180';
    }

    const query = `
      SELECT DISTINCT fp1.${nfCodFornecedorCol} as COD_FORN_ORIG
      FROM ${tabFornecedorProduto} fp1
      JOIN ${tabFornecedorNota} fn1 ON fn1.COD_FORNECEDOR = fp1.${nfCodFornecedorCol}
        AND fn1.NUM_NF_FORN = fp1.${nfNumeroNfCol}
      JOIN ${tabFornecedor} f1 ON f1.COD_FORNECEDOR = fp1.${nfCodFornecedorCol}
      WHERE NVL(fn1.FLG_CANCELADO, 'N') = 'N'
      ${dateFilter}
      ${lojaFilter1}
      AND EXISTS (
        SELECT 1
        FROM ${tabFornecedorProduto} fp2
        JOIN ${tabFornecedor} f2 ON f2.COD_FORNECEDOR = fp2.${nfCodFornecedorCol}
        JOIN ${tabFornecedorNota} fn2 ON fn2.COD_FORNECEDOR = fp2.${nfCodFornecedorCol}
          AND fn2.NUM_NF_FORN = fp2.${nfNumeroNfCol}
        WHERE fp2.COD_PRODUTO = fp1.COD_PRODUTO
        AND fp2.${nfCodFornecedorCol} <> fp1.${nfCodFornecedorCol}
        AND NVL(fn2.FLG_CANCELADO, 'N') = 'N'
        AND fn2.DTA_ENTRADA >= SYSDATE - :diasHist
        AND NVL(f2.NUM_MED_CPGTO, 0) > NVL(f1.NUM_MED_CPGTO, 0)
        ${lojaFilter2}
      )
    `;

    try {
      const rows = await OracleService.query(query, params) as any[];
      const result = new Set(rows.map(r => Number(r.COD_FORN_ORIG)));
      console.log(`[PrazoFornecedores] Fornecedores com melhor prazo disponível: ${result.size}`);
      return result;
    } catch (err: any) {
      console.warn(`[PrazoFornecedores] Erro ao verificar melhor prazo: ${err.message}`);
      return new Set();
    }
  }

  /**
   * Busca fornecedores alternativos que vendem o mesmo produto,
   * com prazo médio (NUM_MED_CPGTO) e último custo pago.
   * Retorna a compra mais recente de cada fornecedor alternativo.
   */
  static async buscarFornecedoresAlternativos(codProduto: number, codFornecedorAtual: number, mesesHistorico: number = 6, codLoja?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
    const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

    const params: any = { codProduto, codFornecedorAtual, diasHistorico: mesesHistorico * 30 };
    let lojaFilter = '';
    if (codLoja) {
      lojaFilter = 'AND fn.COD_LOJA = :codLoja';
      params.codLoja = codLoja;
    }

    const query = `
      SELECT * FROM (
        SELECT
          fp.${nfCodFornecedorCol} as COD_FORNECEDOR,
          NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
          NVL(fp.VAL_TABELA, 0) as VAL_CUSTO,
          NVL(f.NUM_MED_CPGTO, 0) as PRAZO_MEDIO,
          TO_CHAR(fn.DTA_ENTRADA, 'DD/MM/YYYY') as DTA_ULT_COMPRA,
          ROW_NUMBER() OVER (PARTITION BY fp.${nfCodFornecedorCol} ORDER BY fn.DTA_ENTRADA DESC) as RN
        FROM ${tabFornecedorProduto} fp
        JOIN ${tabFornecedor} f ON f.COD_FORNECEDOR = fp.${nfCodFornecedorCol}
        JOIN ${tabFornecedorNota} fn ON fn.COD_FORNECEDOR = fp.${nfCodFornecedorCol}
          AND fn.NUM_NF_FORN = fp.${nfNumeroNfCol}
        WHERE fp.COD_PRODUTO = :codProduto
        AND fp.${nfCodFornecedorCol} <> :codFornecedorAtual
        AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
        AND fn.DTA_ENTRADA >= SYSDATE - :diasHistorico
        ${lojaFilter}
      ) WHERE RN = 1
      ORDER BY PRAZO_MEDIO DESC
    `;

    const rows = await OracleService.query(query, params);
    console.log(`[PrazoFornecedores] Alternativas produto ${codProduto}: ${rows.length} fornecedores (${mesesHistorico} meses)`);
    return rows as any[];
  }
}
