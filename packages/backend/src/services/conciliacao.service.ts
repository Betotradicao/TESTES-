/**
 * Conciliacao Service
 * Cruzamento entre extrato bancário (API Santander) e TAB_FLUXO (sistema Oracle)
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { SantanderService } from './santander.service';

interface ConciliacaoFilters {
  codLoja?: string;
  codBanco?: string;
  bankId?: string; // ID do bank_accounts (PostgreSQL) para API Santander
  mesAno?: string; // YYYY-MM (legacy)
  dtaInicio?: string; // YYYY-MM-DD
  dtaFim?: string; // YYYY-MM-DD
}

interface FluxoItem {
  numRegistro: number;
  desParceiro: string;
  valParcela: number;
  dtaQuitada: string;
  dtaVencimento: string | null;
  numDocto: string | null;
  tipoConta: number;
  flgCompensado: boolean;
}

interface FluxoGroup {
  type: 'bordero' | 'individual';
  numBordero: number | null;
  dtaQuitada: Date;
  dtaQuitadaStr: string;
  valTotal: number;
  numRegistros: number[];
  tipoConta: number;
  desParceiro: string;
  numDocto: string | null;
  flgCompensado: boolean; // all records in group have FLG_COMPENSADO='S'
  desCategoria: string | null;
  desSubcategoria: string | null;
  dtaVencimento: Date | null;
  items?: FluxoItem[]; // individual records inside a bordero
}

interface ConciliacaoRow {
  rowId: string;
  banco: any | null;
  sistema: FluxoGroup | null;
  matchStatus: 'MATCHED' | 'UNMATCHED_BANK' | 'UNMATCHED_SYSTEM';
  isCompensado: boolean;
  candidates?: any[]; // Multiple candidates when same value/date
}

/**
 * Resolve mapping for tables/columns needed
 */
async function resolveMapping() {
  const schema = await MappingService.getSchema();

  const tabFluxo = `${schema}.${await MappingService.getRealTableName('TAB_FLUXO')}`;
  const tabBanco = `${schema}.${await MappingService.getRealTableName('TAB_BANCO')}`;
  const tabCategoria = `${schema}.${await MappingService.getRealTableName('TAB_CATEGORIA')}`;
  const tabSubcategoria = `${schema}.TAB_SUBCATEGORIA`;

  // TAB_FLUXO columns
  const flxNumRegistro = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_registro');
  const flxCodLoja = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_loja');
  const flxTipoConta = await MappingService.getColumnFromTable('TAB_FLUXO', 'tipo_conta');
  const flxDesParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_parceiro');
  const flxDtaQuitada = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_quitada');
  const flxDtaVencimento = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_vencimento');
  const flxValParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_parcela');
  const flxValJuros = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_juros');
  const flxValDesconto = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_desconto');
  const flxValCredito = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_credito');
  const flxValDevolucao = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_devolucao');
  const flxValOutros = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_outros');
  const flxValRetencao = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_retencao');
  const flxValTaxaAdm = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_taxa_adm');
  const flxValDifQuitacao = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_dif_quitacao');
  const flxNumDocto = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_docto');
  const flxCodBancoPgto = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_banco_pgto');
  const flxNumBordero = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_bordero');
  const flxFlgCompensado = await MappingService.getColumnFromTable('TAB_FLUXO', 'flg_compensado');
  const flxFlgQuitado = await MappingService.getColumnFromTable('TAB_FLUXO', 'flg_quitado');
  const flxCodCategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_categoria');
  const flxCodSubcategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_subcategoria');

  // TAB_BANCO columns
  const bcoCodBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'cod_banco');
  const bcoDesBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'des_banco');

  // TAB_CATEGORIA columns
  const catCodCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'cod_categoria');
  const catDesCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'des_categoria');

  return {
    tabFluxo, tabBanco, tabCategoria, tabSubcategoria,
    flxNumRegistro, flxCodLoja, flxTipoConta, flxDesParceiro,
    flxDtaQuitada, flxDtaVencimento, flxValParcela, flxValJuros, flxValDesconto, flxValCredito, flxValDevolucao, flxValOutros, flxValRetencao, flxValTaxaAdm, flxValDifQuitacao, flxNumDocto,
    flxCodBancoPgto, flxNumBordero, flxFlgCompensado, flxFlgQuitado, flxCodCategoria, flxCodSubcategoria,
    bcoCodBanco, bcoDesBanco,
    catCodCategoria, catDesCategoria,
  };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function truncDate(d: any): Date {
  const dt = d instanceof Date ? d : new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** Parse DD/MM/YYYY to Date */
function parseBrazilDate(dateStr: string): Date {
  const parts = (dateStr || '').split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date();
}

/** Split date range into monthly sub-ranges (API max 90 days) */
function splitIntoMonths(initialDate: string, finalDate: string): Array<{start: string, end: string}> {
  const ranges: Array<{start: string, end: string}> = [];
  const startDate = new Date(initialDate + 'T00:00:00');
  const endDate = new Date(finalDate + 'T00:00:00');

  let current = new Date(startDate);
  while (current <= endDate) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const rangeEnd = monthEnd > endDate ? endDate : monthEnd;

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    ranges.push({ start: fmt(current), end: fmt(rangeEnd) });

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return ranges;
}

/** Fetch all pages from Santander API for a date range */
async function fetchBankPages(bankId: string, initialDate: string, finalDate: string): Promise<any[]> {
  const pageSize = 50;
  const BATCH_SIZE = 5;

  const firstPage = await SantanderService.getStatementsForBank(bankId, initialDate, finalDate, pageSize, 1);
  let items: any[] = [];
  if (firstPage._content?.length > 0) {
    items = items.concat(firstPage._content);
  }

  const totalPages = parseInt(firstPage._pageable?.totalPages || '1');

  for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
    const promises: Promise<any>[] = [];

    for (let page = batchStart; page <= batchEnd; page++) {
      promises.push(
        SantanderService.getStatementsForBank(bankId, initialDate, finalDate, pageSize, page)
          .catch(() => new Promise(resolve => setTimeout(resolve, 1000))
            .then(() => SantanderService.getStatementsForBank(bankId, initialDate, finalDate, pageSize, page))
          )
      );
    }

    const results = await Promise.all(promises);
    for (const data of results) {
      if (data?._content?.length > 0) {
        items = items.concat(data._content);
      }
    }
  }

  return items;
}

export class ConciliacaoService {

  /**
   * Busca dados de banco e sistema, faz matching in-memory
   */
  static async getDadosConciliacao(filters: ConciliacaoFilters): Promise<{
    rows: ConciliacaoRow[];
    resumo: any;
  }> {
    const m = await resolveMapping();

    // Parse date range
    let dtaInicio: string;
    let dtaFim: string;
    if (filters.dtaInicio && filters.dtaFim) {
      dtaInicio = filters.dtaInicio;
      dtaFim = filters.dtaFim;
    } else {
      const [year, month] = (filters.mesAno || '').split('-').map(Number);
      if (!year || !month) throw new Error('dtaInicio/dtaFim ou mesAno é obrigatório');
      dtaInicio = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      dtaFim = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    const codLoja = Number(filters.codLoja) || 1;
    const codBanco = Number(filters.codBanco);

    // --- Step 1: Fetch bank data from Santander API ---
    let movBcoRows: any[] = [];
    if (filters.bankId) {
      console.log(`[Conciliacao] Buscando extrato Santander bankId=${filters.bankId} de ${dtaInicio} a ${dtaFim}`);
      const monthRanges = splitIntoMonths(dtaInicio, dtaFim);
      let allBankItems: any[] = [];

      for (const range of monthRanges) {
        try {
          const items = await fetchBankPages(filters.bankId, range.start, range.end);
          allBankItems = allBankItems.concat(items);
        } catch (err: any) {
          console.error(`[Conciliacao] Erro no mês ${range.start}: ${err.message}`);
        }
      }

      console.log(`[Conciliacao] Total extrato banco: ${allBankItems.length} lançamentos`);

      // Normalize Santander API items to compatible field names
      movBcoRows = allBankItems.map((item, idx) => {
        const dateObj = parseBrazilDate(item.transactionDate);
        return {
          COD_CHAVE: `api_${idx}`,
          DTA_ENTRADA: dateObj,
          FAVORECIDO: [item.transactionName, item.historicComplement].filter(Boolean).join(' - '),
          VAL_DOCTO: parseFloat(item.amount) || 0,
          TIPO_OPERACAO: item.creditDebitType === 'CREDITO' ? 0 : 1,
          NUM_DOCTO_PGTO: null,
          DES_OBSERVACAO: item.historicComplement || '',
          creditDebitType: item.creditDebitType,
          transactionName: item.transactionName,
          historicComplement: item.historicComplement,
          transactionDate: item.transactionDate,
        };
      });
    } else {
      console.log('[Conciliacao] Sem bankId configurado - lado banco ficará vazio');
    }

    // --- Query 2: TAB_FLUXO (sistema - quitados) ---
    const flxSql = `
      SELECT
        f.${m.flxNumRegistro} AS NUM_REGISTRO,
        f.${m.flxTipoConta} AS TIPO_CONTA,
        f.${m.flxDesParceiro} AS DES_PARCEIRO,
        TRUNC(f.${m.flxDtaQuitada}) AS DTA_QUITADA,
        f.${m.flxDtaVencimento} AS DTA_VENCIMENTO,
        f.${m.flxValParcela} AS VAL_PARCELA,
        NVL(f.${m.flxValParcela}, 0) + NVL(f.${m.flxValJuros}, 0) - NVL(f.${m.flxValDesconto}, 0) + NVL(f.${m.flxValCredito}, 0) - NVL(f.${m.flxValDevolucao}, 0) + NVL(f.${m.flxValOutros}, 0) - NVL(f.${m.flxValRetencao}, 0) - NVL(f.${m.flxValTaxaAdm}, 0) + NVL(f.${m.flxValDifQuitacao}, 0) AS VAL_LIQUIDO,
        f.${m.flxNumDocto} AS NUM_DOCTO,
        f.${m.flxCodBancoPgto} AS COD_BANCO_PGTO,
        f.${m.flxNumBordero} AS NUM_BORDERO,
        f.${m.flxFlgCompensado} AS FLG_COMPENSADO,
        c.${m.catDesCategoria} AS DES_CATEGORIA,
        sc.DES_SUBCATEGORIA AS DES_SUBCATEGORIA
      FROM ${m.tabFluxo} f
      LEFT JOIN ${m.tabCategoria} c ON c.${m.catCodCategoria} = f.${m.flxCodCategoria}
      LEFT JOIN ${m.tabSubcategoria} sc ON sc.COD_SUBCATEGORIA = f.${m.flxCodSubcategoria} AND sc.COD_CATEGORIA = f.${m.flxCodCategoria}
      WHERE f.${m.flxFlgQuitado} = 'S'
        AND f.${m.flxCodLoja} = :codLoja
        AND f.${m.flxCodBancoPgto} = :codBanco
        AND f.${m.flxDtaQuitada} >= TO_DATE(:dtaInicio, 'YYYY-MM-DD')
        AND f.${m.flxDtaQuitada} <= TO_DATE(:dtaFim, 'YYYY-MM-DD') + 0.99999
      ORDER BY f.${m.flxDtaQuitada}, f.${m.flxNumRegistro}
    `;
    const fluxoRowsRaw = await OracleService.query<any>(flxSql, { codLoja, codBanco, dtaInicio, dtaFim });

    // Deduplicate by NUM_REGISTRO (LEFT JOINs may cause duplicate rows)
    const seenRegistros = new Set<number>();
    const fluxoRows = fluxoRowsRaw.filter((row: any) => {
      const nr = Number(row.NUM_REGISTRO);
      if (seenRegistros.has(nr)) return false;
      seenRegistros.add(nr);
      return true;
    });
    console.log(`[Conciliacao] TAB_FLUXO: ${fluxoRowsRaw.length} rows brutos -> ${fluxoRows.length} únicos`);

    // --- Step A: Group FLUXO by bordero ---
    const fluxoGroups: FluxoGroup[] = [];
    const borderoMap = new Map<string, FluxoGroup>();

    for (const row of fluxoRows) {
      const dtaQ = truncDate(row.DTA_QUITADA);
      const parsedLiquido = parseFloat(row.VAL_LIQUIDO);
      const val = Math.abs(!isNaN(parsedLiquido) ? parsedLiquido : (parseFloat(row.VAL_PARCELA) || 0));
      const numBordero = row.NUM_BORDERO ? Number(row.NUM_BORDERO) : null;
      const numReg = Number(row.NUM_REGISTRO);
      // Ignorar FLG_COMPENSADO do Oracle - conciliação é feita apenas por esta tela
      const compensado = false;
      const parceiro = (row.DES_PARCEIRO || '').trim();

      const item: FluxoItem = {
        numRegistro: numReg,
        desParceiro: parceiro,
        valParcela: val,
        dtaQuitada: toDateStr(dtaQ),
        dtaVencimento: row.DTA_VENCIMENTO ? toDateStr(truncDate(row.DTA_VENCIMENTO)) : null,
        numDocto: row.NUM_DOCTO || null,
        tipoConta: Number(row.TIPO_CONTA),
        flgCompensado: compensado,
      };

      if (numBordero) {
        const key = `${numBordero}_${toDateStr(dtaQ)}`;
        let group = borderoMap.get(key);
        if (group) {
          group.valTotal += val;
          group.numRegistros.push(numReg);
          group.items!.push(item);
          if (!compensado) group.flgCompensado = false;
        } else {
          group = {
            type: 'bordero',
            numBordero,
            dtaQuitada: dtaQ,
            dtaQuitadaStr: toDateStr(dtaQ),
            valTotal: val,
            numRegistros: [numReg],
            tipoConta: Number(row.TIPO_CONTA),
            desParceiro: parceiro || `Borderô ${numBordero}`,
            numDocto: row.NUM_DOCTO || null,
            flgCompensado: compensado,
            desCategoria: row.DES_CATEGORIA || null,
            desSubcategoria: row.DES_SUBCATEGORIA || null,
            dtaVencimento: row.DTA_VENCIMENTO ? truncDate(row.DTA_VENCIMENTO) : null,
            items: [item],
          };
          borderoMap.set(key, group);
          fluxoGroups.push(group);
        }
      } else {
        fluxoGroups.push({
          type: 'individual',
          numBordero: null,
          dtaQuitada: dtaQ,
          dtaQuitadaStr: toDateStr(dtaQ),
          valTotal: val,
          numRegistros: [numReg],
          tipoConta: Number(row.TIPO_CONTA),
          desParceiro: parceiro,
          numDocto: row.NUM_DOCTO || null,
          flgCompensado: compensado,
          desCategoria: row.DES_CATEGORIA || null,
          desSubcategoria: row.DES_SUBCATEGORIA || null,
          dtaVencimento: row.DTA_VENCIMENTO ? truncDate(row.DTA_VENCIMENTO) : null,
        });
      }
    }

    // Fix bordero group names: same supplier = keep name, multiple = "CARTÃO DE CRÉDITO"
    for (const group of fluxoGroups) {
      if (group.type === 'bordero' && group.items && group.items.length > 1) {
        const uniqueNames = new Set(group.items.map(i => i.desParceiro.toUpperCase()));
        if (uniqueNames.size === 1) {
          group.desParceiro = group.items[0].desParceiro;
        } else {
          group.desParceiro = 'MÚLTIPLOS PAGAMENTOS';
        }
      }
    }

    // --- Step B: Match MOV_BCO → FLUXO groups ---
    const availableGroups = new Set(fluxoGroups);
    const rows: ConciliacaoRow[] = [];
    let rowIdx = 0;

    // Helper: name similarity (simple word overlap score)
    function nameSimilarity(a: string, b: string): number {
      const wa = (a || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2);
      const wb = new Set((b || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2));
      if (wa.length === 0) return 0;
      let matches = 0;
      for (const w of wa) { if (wb.has(w)) matches++; }
      return matches / wa.length;
    }

    for (const mb of movBcoRows) {
      const mbDate = truncDate(mb.DTA_ENTRADA);
      const mbDateStr = toDateStr(mbDate);
      const mbVal = Math.abs(parseFloat(mb.VAL_DOCTO) || 0);
      const mbDocto = mb.NUM_DOCTO_PGTO ? String(mb.NUM_DOCTO_PGTO).trim() : null;
      const mbNome = (mb.FAVORECIDO || '').replace(/\s*BORD[.:]*\s*\d*/gi, '').trim();

      // Primary: same date + same value
      const candidates: FluxoGroup[] = [];
      for (const fg of availableGroups) {
        if (fg.dtaQuitadaStr === mbDateStr && Math.abs(fg.valTotal - mbVal) < 0.02) {
          candidates.push(fg);
        }
      }

      // Secondary: document number + within 3 days
      if (candidates.length === 0 && mbDocto) {
        for (const fg of availableGroups) {
          if (fg.numDocto && String(fg.numDocto).trim() === mbDocto) {
            const daysDiff = Math.abs(mbDate.getTime() - fg.dtaQuitada.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 3) {
              candidates.push(fg);
            }
          }
        }
      }

      // Pick best candidate: prefer name similarity as tiebreaker
      let picked: FluxoGroup | null = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else if (candidates.length > 1) {
        // Sort by name similarity (highest first)
        candidates.sort((a, b) => nameSimilarity(mbNome, b.desParceiro) - nameSimilarity(mbNome, a.desParceiro));
        picked = candidates[0];
      }

      if (picked) {
        availableGroups.delete(picked);
        rows.push({
          rowId: `r${rowIdx++}`,
          banco: mb,
          sistema: picked,
          matchStatus: 'MATCHED',
          isCompensado: picked.flgCompensado,
        });
      } else {
        rows.push({
          rowId: `r${rowIdx++}`,
          banco: mb,
          sistema: null,
          matchStatus: 'UNMATCHED_BANK',
          isCompensado: false,
        });
      }
    }

    // --- Step C: Remaining unmatched FLUXO groups ---
    for (const fg of availableGroups) {
      rows.push({
        rowId: `r${rowIdx++}`,
        banco: null,
        sistema: fg,
        matchStatus: 'UNMATCHED_SYSTEM',
        isCompensado: fg.flgCompensado,
      });
    }

    // Sort: by date (banco date or sistema date), then matched first
    rows.sort((a, b) => {
      const dateA = a.banco ? truncDate(a.banco.DTA_ENTRADA).getTime() : (a.sistema ? a.sistema.dtaQuitada.getTime() : 0);
      const dateB = b.banco ? truncDate(b.banco.DTA_ENTRADA).getTime() : (b.sistema ? b.sistema.dtaQuitada.getTime() : 0);
      if (dateA !== dateB) return dateA - dateB;
      // Matched first
      if (a.matchStatus === 'MATCHED' && b.matchStatus !== 'MATCHED') return -1;
      if (a.matchStatus !== 'MATCHED' && b.matchStatus === 'MATCHED') return 1;
      return 0;
    });

    // --- Resumo ---
    const totalBanco = movBcoRows.length;
    const totalSistema = fluxoGroups.length;
    const totalMatched = rows.filter(r => r.matchStatus === 'MATCHED').length;
    const totalCompensado = rows.filter(r => r.isCompensado).length;
    const unmatchedBanco = rows.filter(r => r.matchStatus === 'UNMATCHED_BANK').length;
    const unmatchedSistema = rows.filter(r => r.matchStatus === 'UNMATCHED_SYSTEM').length;
    const valMatchedBanco = rows.filter(r => r.matchStatus === 'MATCHED' && r.banco)
      .reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);
    const valUnmatchedBanco = rows.filter(r => r.matchStatus === 'UNMATCHED_BANK' && r.banco)
      .reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);
    const valUnmatchedSistema = rows.filter(r => r.matchStatus === 'UNMATCHED_SYSTEM' && r.sistema)
      .reduce((s, r) => s + r.sistema!.valTotal, 0);

    return {
      rows,
      resumo: {
        totalBanco,
        totalSistema,
        totalMatched,
        totalCompensado,
        unmatchedBanco,
        unmatchedSistema,
        valMatchedBanco,
        valUnmatchedBanco,
        valUnmatchedSistema,
      }
    };
  }

  /**
   * Lista bancos que possuem pagamentos quitados em TAB_FLUXO
   */
  static async getBancos(codLoja?: string): Promise<any[]> {
    const m = await resolveMapping();
    let where = '';
    const params: any = {};
    if (codLoja) {
      where = `AND f.${m.flxCodLoja} = :codLoja`;
      params.codLoja = Number(codLoja);
    }
    const sql = `
      SELECT DISTINCT b.${m.bcoCodBanco} AS COD_BANCO, b.${m.bcoDesBanco} AS DES_BANCO
      FROM ${m.tabBanco} b
      WHERE EXISTS (
        SELECT 1 FROM ${m.tabFluxo} f
        WHERE f.${m.flxCodBancoPgto} = b.${m.bcoCodBanco}
          AND f.${m.flxFlgQuitado} = 'S'
          ${where}
      )
      ORDER BY b.${m.bcoDesBanco}
    `;
    return OracleService.query(sql, params);
  }

  /**
   * Marca registros como conciliados (FLG_COMPENSADO = 'S')
   * Por ora, apenas retorna sucesso (OracleService é read-only)
   * TODO: Implementar UPDATE quando houver conexão com permissão de escrita
   */
  static async conciliarRegistros(numRegistros: number[]): Promise<{ updated: number }> {
    if (!numRegistros.length) return { updated: 0 };

    // Por enquanto, retornar sucesso simulado
    // O UPDATE real seria:
    // UPDATE TAB_FLUXO SET FLG_COMPENSADO = 'S' WHERE NUM_REGISTRO IN (...)
    console.log(`[Conciliação] Solicitado conciliar ${numRegistros.length} registros:`, numRegistros.slice(0, 10));

    return { updated: numRegistros.length };
  }
}
