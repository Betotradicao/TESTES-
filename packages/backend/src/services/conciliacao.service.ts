/**
 * Conciliacao Service
 * Cruzamento entre extrato bancário (API Santander) e TAB_FLUXO (sistema Oracle)
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { SantanderService } from './santander.service';
import { AppDataSource } from '../config/database';
import { BankTransfer } from '../entities/BankTransfer';
import { BankAccount } from '../entities/BankAccount';
import { ConciliacaoAmarracao } from '../entities/ConciliacaoAmarracao';
import { ConciliacaoMovimento } from '../entities/ConciliacaoMovimento';
import { PlanoConta } from '../entities/PlanoConta';

interface ConciliacaoFilters {
  codLoja?: string;
  codBanco?: string;
  codBancoSistema?: string; // Banco para filtrar no sistema (TAB_FLUXO), pode ser diferente do banco API
  bankId?: string; // ID do bank_accounts (PostgreSQL) para API Santander
  desCc?: string; // Conta corrente (DES_CC) para filtrar no sistema
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
  desSubcategoria: string | null;
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
  const tabSubcategoria = `${schema}.${await MappingService.getRealTableName('TAB_SUBCATEGORIA', 'TAB_SUBCATEGORIA')}`;

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
  const flxDesCc = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_cc', 'DES_CC');

  // TAB_BANCO columns
  const bcoCodBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'cod_banco');
  const bcoDesBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'des_banco');

  // TAB_BANCO_CC (contas correntes)
  const tabBancoCc = `${schema}.${await MappingService.getRealTableName('TAB_BANCO_CC', 'TAB_BANCO_CC')}`;

  // TAB_CATEGORIA columns
  const catCodCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'cod_categoria');
  const catDesCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'des_categoria');

  // TAB_SUBCATEGORIA columns
  const scCodSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_subcategoria', 'COD_SUBCATEGORIA');
  const scDesSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'des_subcategoria', 'DES_SUBCATEGORIA');
  const scCodCategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_categoria', 'COD_CATEGORIA');

  // TAB_BANCO_CC columns
  const ccCodBanco = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'cod_banco', 'COD_BANCO');
  const ccDesCc = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'descricao_banco_cc', 'DES_CC');
  const ccDesAgencia = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'num_agencia', 'DES_AGENCIA');
  const ccDesApelido = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'des_apelido', 'DES_APELIDO');
  const ccInativo = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'inativo', 'INATIVO');
  const ccIdConta = await MappingService.getColumnFromTable('TAB_BANCO_CC', 'id_conta', 'ID_CONTA');

  return {
    tabFluxo, tabBanco, tabBancoCc, tabCategoria, tabSubcategoria,
    flxNumRegistro, flxCodLoja, flxTipoConta, flxDesParceiro,
    flxDtaQuitada, flxDtaVencimento, flxValParcela, flxValJuros, flxValDesconto, flxValCredito, flxValDevolucao, flxValOutros, flxValRetencao, flxValTaxaAdm, flxValDifQuitacao, flxNumDocto,
    flxCodBancoPgto, flxNumBordero, flxFlgCompensado, flxFlgQuitado, flxCodCategoria, flxCodSubcategoria, flxDesCc,
    bcoCodBanco, bcoDesBanco,
    catCodCategoria, catDesCategoria,
    ccCodBanco, ccDesCc, ccDesAgencia, ccDesApelido, ccInativo, ccIdConta,
    scCodSubcategoria, scDesSubcategoria, scCodCategoria,
  };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Chave estável de um movimento do extrato: data|valor|texto|tipoOperacao */
function movKeyOf(mb: any): string {
  const d = toDateStr(mb.DTA_ENTRADA instanceof Date ? new Date(mb.DTA_ENTRADA.getFullYear(), mb.DTA_ENTRADA.getMonth(), mb.DTA_ENTRADA.getDate()) : new Date(mb.DTA_ENTRADA));
  const v = Math.abs(parseFloat(mb.VAL_DOCTO) || 0).toFixed(2);
  const t = (mb.FAVORECIDO || '').trim();
  return `${d}|${v}|${t}|${mb.TIPO_OPERACAO}`;
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
    // Banco para filtrar no sistema: usa codBancoSistema se informado, senão usa codBanco
    const codBancoSistema = filters.codBancoSistema ? Number(filters.codBancoSistema) : codBanco;

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
        (SELECT c.${m.catDesCategoria} FROM ${m.tabCategoria} c WHERE c.${m.catCodCategoria} = f.${m.flxCodCategoria} AND ROWNUM = 1) AS DES_CATEGORIA,
        (SELECT sc.${m.scDesSubcategoria} FROM ${m.tabSubcategoria} sc WHERE sc.${m.scCodSubcategoria} = f.${m.flxCodSubcategoria} AND sc.${m.scCodCategoria} = f.${m.flxCodCategoria} AND ROWNUM = 1) AS DES_SUBCATEGORIA
      FROM ${m.tabFluxo} f
      WHERE f.${m.flxFlgQuitado} = 'S'
        AND f.${m.flxCodLoja} = :codLoja
        AND f.${m.flxCodBancoPgto} = :codBanco
        AND f.${m.flxDtaQuitada} >= TO_DATE(:dtaInicio, 'YYYY-MM-DD')
        AND f.${m.flxDtaQuitada} <= TO_DATE(:dtaFim, 'YYYY-MM-DD') + 0.99999
        ${filters.desCc ? `AND f.${m.flxDesCc} = :desCc` : ''}
      ORDER BY f.${m.flxDtaQuitada}, f.${m.flxNumRegistro}
    `;
    const flxParams: any = { codLoja, codBanco: codBancoSistema, dtaInicio, dtaFim };
    if (filters.desCc) flxParams.desCc = filters.desCc;
    const fluxoRows = await OracleService.query<any>(flxSql, flxParams);
    console.log(`[Conciliacao] TAB_FLUXO: ${fluxoRows.length} registros`);

    // --- Step A: Group FLUXO by bordero ---
    const fluxoGroups: FluxoGroup[] = [];
    const borderoMap = new Map<string, FluxoGroup>();

    for (const row of fluxoRows) {
      const dtaQ = truncDate(row.DTA_QUITADA);
      const parsedLiquido = parseFloat(row.VAL_LIQUIDO);
      const val = Math.abs(!isNaN(parsedLiquido) ? parsedLiquido : (parseFloat(row.VAL_PARCELA) || 0));
      const numBordero = row.NUM_BORDERO ? Number(row.NUM_BORDERO) : null;
      const numReg = Number(row.NUM_REGISTRO);
      const compensado = row.FLG_COMPENSADO === 'S';
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
        desSubcategoria: row.DES_SUBCATEGORIA || null,
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

    // Fix bordero group names: same supplier = keep name, multiple = "MÚLTIPLOS PAGAMENTOS"
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

    console.log(`[Conciliacao] ${fluxoGroups.length} grupos (${borderoMap.size} borderôs + ${fluxoGroups.length - borderoMap.size} individuais)`);

    // --- Step B: Match MOV_BCO → FLUXO groups ---
    const availableGroups = new Set(fluxoGroups);
    const rows: ConciliacaoRow[] = [];
    let rowIdx = 0;

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
      const mbNome = (mb.FAVORECIDO || '').replace(/\s*BORD[.:]*\s*\d*/gi, '').trim();

      // Tipo compatível: banco crédito (0) ↔ sistema receber (1), banco débito (1) ↔ sistema pagar (!=1)
      const mbIsCredito = mb.TIPO_OPERACAO === 0;

      // Primary: same date + same value + same type (entrada/saída)
      const candidates: FluxoGroup[] = [];
      for (const fg of availableGroups) {
        const fgIsEntrada = fg.tipoConta === 1;
        const tipoCompativel = mbIsCredito === fgIsEntrada;
        if (fg.dtaQuitadaStr === mbDateStr && Math.abs(fg.valTotal - mbVal) < 0.02 && tipoCompativel) {
          candidates.push(fg);
        }
      }


      // Pick best candidate: prefer name similarity as tiebreaker
      let picked: FluxoGroup | null = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else if (candidates.length > 1) {
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
          candidates: candidates.length > 1 ? candidates : undefined,
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

    // --- Step D: Match transferências entre contas ---
    if (filters.bankId && AppDataSource.isInitialized) {
      try {
        const transfers = await ConciliacaoService.getTransferencias(filters.bankId, dtaInicio, dtaFim);
        if (transfers.length > 0) {
          console.log(`[Conciliacao] ${transfers.length} transferências encontradas para esta conta`);

          for (const transfer of transfers) {
            const isSource = transfer.source_account_id === filters.bankId;
            const transferAmount = Number(transfer.amount);
            const transferDate = typeof transfer.date === 'string'
              ? transfer.date.substring(0, 10)
              : toDateStr(truncDate(transfer.date));

            // Procurar row UNMATCHED_BANK com mesmo valor e data
            const unmatchedRow = rows.find(r => {
              if (r.matchStatus !== 'UNMATCHED_BANK' || !r.banco) return false;
              const rowDate = toDateStr(truncDate(r.banco.DTA_ENTRADA));
              const rowVal = Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0);
              return rowDate === transferDate && Math.abs(rowVal - transferAmount) < 0.02;
            });

            const otherAccount = isSource ? transfer.targetAccount : transfer.sourceAccount;
            const otherName = otherAccount
              ? `${otherAccount.nome}${otherAccount.conta ? ` | Conta: ${otherAccount.conta}` : ''}`
              : 'Outra conta';

            if (unmatchedRow) {
              // Movimento real encontrado → marcar MATCHED com sistema sintético
              unmatchedRow.sistema = {
                type: 'individual',
                numBordero: null,
                dtaQuitada: truncDate(transfer.date),
                dtaQuitadaStr: transferDate,
                valTotal: transferAmount,
                numRegistros: [],
                tipoConta: isSource ? 2 : 1,
                desParceiro: isSource ? `Transferido para ${otherName}` : `Recebido de ${otherName}`,
                numDocto: null,
                flgCompensado: false,
                desCategoria: 'Transferência entre Contas',
                desSubcategoria: 'Transferência entre Contas',
                dtaVencimento: null,
                transferId: transfer.id,
              } as any;
              unmatchedRow.matchStatus = 'MATCHED';
              unmatchedRow.isCompensado = false;
              (unmatchedRow as any).isTransfer = true;
              (unmatchedRow as any).transferId = transfer.id;
            } else {
              // Sem movimento real → criar linha com banco SINTÉTICO (transferência esperada)
              rows.push({
                rowId: `r${rowIdx++}`,
                banco: {
                  DTA_ENTRADA: transfer.date,
                  FAVORECIDO: isSource
                    ? `Transferência para ${otherName}`
                    : `Transferência de ${otherName}`,
                  VAL_DOCTO: String(isSource ? -transferAmount : transferAmount),
                  TIPO_OPERACAO: isSource ? 1 : 0,
                  isSynthetic: true,
                },
                sistema: null,
                matchStatus: 'UNMATCHED_BANK',
                isCompensado: false,
                isTransfer: true,
                transferId: transfer.id,
              } as any);
            }
          }
        }
      } catch (err: any) {
        console.error('[Conciliacao] Erro ao buscar transferências:', err.message);
      }
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
      SELECT b.${m.bcoCodBanco} AS COD_BANCO, b.${m.bcoDesBanco} AS DES_BANCO
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
   * Lista contas correntes (TAB_BANCO_CC) de um banco específico
   */
  static async getContasCorrentes(codBanco: number): Promise<any[]> {
    const m = await resolveMapping();
    const sql = `
      SELECT cc.${m.ccCodBanco} AS COD_BANCO, cc.${m.ccDesCc} AS DES_CC, cc.${m.ccDesAgencia} AS DES_AGENCIA, cc.${m.ccDesApelido} AS DES_APELIDO, cc.${m.ccInativo} AS INATIVO, cc.${m.ccIdConta} AS ID_CONTA
      FROM ${m.tabBancoCc} cc
      WHERE cc.${m.ccCodBanco} = :codBanco AND NVL(cc.${m.ccInativo}, 'N') = 'N'
      ORDER BY cc.${m.ccDesApelido}
    `;
    return OracleService.query(sql, { codBanco });
  }

  /**
   * Marca registros como conciliados (FLG_COMPENSADO = 'S')
   */
  static async conciliarRegistros(numRegistros: number[]): Promise<{ updated: number }> {
    if (!numRegistros.length) return { updated: 0 };
    console.log(`[Conciliação] Conciliando ${numRegistros.length} registros:`, numRegistros.slice(0, 10));

    const m = await resolveMapping();

    // UPDATE em lotes de 50 (Oracle IN limit = 1000, mas lotes menores são mais seguros)
    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    for (let i = 0; i < numRegistros.length; i += BATCH_SIZE) {
      const batch = numRegistros.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, idx) => `:r${idx}`).join(',');
      const binds: any = {};
      batch.forEach((nr, idx) => { binds[`r${idx}`] = nr; });

      const sql = `
        UPDATE ${m.tabFluxo}
        SET ${m.flxFlgCompensado} = 'S'
        WHERE ${m.flxNumRegistro} IN (${placeholders})
      `;

      const conn = await OracleService.getConnection();
      try {
        const result = await conn.execute(sql, binds, { autoCommit: true });
        totalUpdated += result.rowsAffected || 0;
      } finally {
        await conn.close();
      }
    }

    console.log(`[Conciliação] ${totalUpdated} registros atualizados com FLG_COMPENSADO='S'`);
    return { updated: totalUpdated };
  }

  /**
   * Registra uma transferência entre contas
   */
  static async registrarTransferencia(data: {
    sourceAccountId: string;
    targetAccountId: string;
    amount: number;
    date: string;
    description?: string;
  }): Promise<BankTransfer> {
    const repo = AppDataSource.getRepository(BankTransfer);

    // Evitar duplicatas: mesma origem, destino, valor e data
    const existing = await repo.findOne({
      where: {
        source_account_id: data.sourceAccountId,
        target_account_id: data.targetAccountId,
        amount: data.amount as any,
        date: data.date,
      }
    });

    if (existing) {
      console.log(`[Conciliação] Transferência já existe (id=${existing.id}), retornando existente`);
      return existing;
    }

    const transfer = repo.create({
      source_account_id: data.sourceAccountId,
      target_account_id: data.targetAccountId,
      amount: data.amount,
      date: data.date,
      description: data.description || '',
    });

    const saved = await repo.save(transfer);
    console.log(`[Conciliação] Transferência registrada: ${data.sourceAccountId} → ${data.targetAccountId}, R$ ${data.amount}, data ${data.date}`);
    return saved;
  }

  /**
   * Busca transferências registradas onde a conta é origem OU destino
   */
  static async getTransferencias(accountId: string, dtaInicio: string, dtaFim: string): Promise<BankTransfer[]> {
    const repo = AppDataSource.getRepository(BankTransfer);
    const transfers = await repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sourceAccount', 'source')
      .leftJoinAndSelect('t.targetAccount', 'target')
      .where('(t.source_account_id = :accountId OR t.target_account_id = :accountId)', { accountId })
      .andWhere('t.date >= :dtaInicio', { dtaInicio })
      .andWhere('t.date <= :dtaFim', { dtaFim })
      .getMany();

    return transfers;
  }

  /**
   * Remove uma transferência entre contas
   */
  static async removerTransferencia(transferId: string): Promise<boolean> {
    const repo = AppDataSource.getRepository(BankTransfer);
    const result = await repo.delete(transferId);
    return (result.affected || 0) > 0;
  }

  // ============ MODO "DIRETO MANUAL" ============

  /** Lista amarrações da loja com o nome da conta e do grupo resolvidos */
  static async getAmarracoes(codLoja: number): Promise<Record<string, any>> {
    const amRepo = AppDataSource.getRepository(ConciliacaoAmarracao);
    const pcRepo = AppDataSource.getRepository(PlanoConta);
    const [amarracoes, contas] = await Promise.all([
      amRepo.find({ where: { cod_loja: codLoja } }),
      pcRepo.find({ where: { cod_loja: codLoja } }),
    ]);
    const contaById = new Map<number, PlanoConta>();
    for (const c of contas) contaById.set(c.id, c);

    // Retorna um mapa texto_exato -> info da conta (o front casa por texto exato)
    const map: Record<string, any> = {};
    for (const a of amarracoes) {
      const conta = contaById.get(a.plano_conta_id);
      const grupo = conta?.parent_id ? contaById.get(conta.parent_id) : null;
      map[a.texto_exato] = {
        plano_conta_id: a.plano_conta_id,
        conta_nome: conta?.nome || '(conta removida)',
        grupo_nome: grupo?.nome || null,
        is_receita: conta?.is_receita ?? false,
      };
    }
    return map;
  }

  /** Cria/atualiza amarração (texto exato -> conta). Idempotente por (loja, texto). */
  static async salvarAmarracao(codLoja: number, textoExato: string, planoContaId: number): Promise<ConciliacaoAmarracao> {
    const repo = AppDataSource.getRepository(ConciliacaoAmarracao);
    const texto = (textoExato || '').trim();
    if (!texto) throw new Error('texto_exato é obrigatório');
    if (!planoContaId) throw new Error('plano_conta_id é obrigatório');

    let row = await repo.findOne({ where: { cod_loja: codLoja, texto_exato: texto } });
    if (row) {
      row.plano_conta_id = planoContaId;
    } else {
      row = repo.create({ cod_loja: codLoja, texto_exato: texto, plano_conta_id: planoContaId });
    }
    return repo.save(row);
  }

  /** Remove a amarração de um texto exato */
  static async removerAmarracao(codLoja: number, textoExato: string): Promise<boolean> {
    const repo = AppDataSource.getRepository(ConciliacaoAmarracao);
    const res = await repo.delete({ cod_loja: codLoja, texto_exato: (textoExato || '').trim() });
    return (res.affected || 0) > 0;
  }

  /** Classificações por movimento específico (única/transferência): mov_key -> info */
  static async getMovimentos(codLoja: number): Promise<Record<string, any>> {
    const movRepo = AppDataSource.getRepository(ConciliacaoMovimento);
    const pcRepo = AppDataSource.getRepository(PlanoConta);
    const [movs, contas] = await Promise.all([
      movRepo.find({ where: { cod_loja: codLoja } }),
      pcRepo.find({ where: { cod_loja: codLoja } }),
    ]);
    const contaById = new Map<number, PlanoConta>();
    for (const c of contas) contaById.set(c.id, c);
    const map: Record<string, any> = {};
    for (const m of movs) {
      if (m.tipo === 'transferencia') {
        map[m.mov_key] = { origem: 'transferencia', transfer_id: m.transfer_id };
      } else if (m.tipo === 'fatura') {
        const itens = (m.itens || []).map(it => {
          const conta = contaById.get(it.plano_conta_id);
          const grupo = conta?.parent_id ? contaById.get(conta.parent_id) : null;
          return {
            plano_conta_id: it.plano_conta_id,
            valor: Number(it.valor) || 0,
            conta_nome: conta?.nome || '(conta removida)',
            grupo_nome: grupo?.nome || null,
            is_receita: conta?.is_receita ?? false,
          };
        });
        map[m.mov_key] = { origem: 'fatura', itens, total: itens.reduce((s, i) => s + i.valor, 0) };
      } else {
        const conta = m.plano_conta_id ? contaById.get(m.plano_conta_id) : null;
        const grupo = conta?.parent_id ? contaById.get(conta.parent_id) : null;
        map[m.mov_key] = {
          origem: 'unica',
          plano_conta_id: m.plano_conta_id,
          conta_nome: conta?.nome || '(conta removida)',
          grupo_nome: grupo?.nome || null,
          is_receita: conta?.is_receita ?? false,
        };
      }
    }
    return map;
  }

  /** Classificação ÚNICA de um movimento (pontual, não propaga) */
  static async salvarMovimentoUnica(codLoja: number, movKey: string, planoContaId: number): Promise<ConciliacaoMovimento> {
    const repo = AppDataSource.getRepository(ConciliacaoMovimento);
    if (!movKey) throw new Error('mov_key é obrigatório');
    if (!planoContaId) throw new Error('plano_conta_id é obrigatório');
    let row = await repo.findOne({ where: { cod_loja: codLoja, mov_key: movKey } });
    if (row) { row.tipo = 'unica'; row.plano_conta_id = planoContaId; row.transfer_id = null; }
    else row = repo.create({ cod_loja: codLoja, mov_key: movKey, tipo: 'unica', plano_conta_id: planoContaId });
    return repo.save(row);
  }

  /** FATURA: um movimento com vários lançamentos (conta + valor) que somam o valor do banco */
  static async salvarMovimentoFatura(codLoja: number, movKey: string, itens: { plano_conta_id: number; valor: number }[]): Promise<ConciliacaoMovimento> {
    const repo = AppDataSource.getRepository(ConciliacaoMovimento);
    if (!movKey) throw new Error('mov_key é obrigatório');
    const clean = (itens || [])
      .filter(i => i.plano_conta_id && Number(i.valor) > 0)
      .map(i => ({ plano_conta_id: Number(i.plano_conta_id), valor: Number(i.valor) }));
    if (!clean.length) throw new Error('Informe ao menos um lançamento válido');
    let row = await repo.findOne({ where: { cod_loja: codLoja, mov_key: movKey } });
    if (row) { row.tipo = 'fatura'; row.itens = clean; row.plano_conta_id = null; row.transfer_id = null; }
    else row = repo.create({ cod_loja: codLoja, mov_key: movKey, tipo: 'fatura', itens: clean });
    return repo.save(row);
  }

  /** Marca um movimento como TRANSFERÊNCIA entre contas (cria BankTransfer, fora do DRE) */
  static async salvarMovimentoTransferencia(codLoja: number, movKey: string, transferData: {
    sourceAccountId: string; targetAccountId: string; amount: number; date: string; description?: string;
  }): Promise<any> {
    const transfer = await ConciliacaoService.registrarTransferencia(transferData);
    const repo = AppDataSource.getRepository(ConciliacaoMovimento);
    let row = await repo.findOne({ where: { cod_loja: codLoja, mov_key: movKey } });
    if (row) { row.tipo = 'transferencia'; row.transfer_id = transfer.id; row.plano_conta_id = null; }
    else row = repo.create({ cod_loja: codLoja, mov_key: movKey, tipo: 'transferencia', transfer_id: transfer.id });
    await repo.save(row);
    return { movimento: row, transfer };
  }

  /** Remove a classificação por movimento (e a transferência vinculada, se houver) */
  static async removerMovimento(codLoja: number, movKey: string): Promise<boolean> {
    const repo = AppDataSource.getRepository(ConciliacaoMovimento);
    const row = await repo.findOne({ where: { cod_loja: codLoja, mov_key: movKey } });
    if (!row) return false;
    if (row.tipo === 'transferencia' && row.transfer_id) {
      try { await ConciliacaoService.removerTransferencia(row.transfer_id); } catch { /* ignore */ }
    }
    await repo.delete(row.id);
    return true;
  }

  /**
   * Modo Manual: busca o extrato do banco (Santander API) e anexa a classificação de cada
   * linha (movimento único/transferência tem prioridade; senão a amarração por texto). NÃO usa Oracle.
   */
  static async getDadosManual(filters: ConciliacaoFilters): Promise<{ rows: any[]; resumo: any }> {
    // Período
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

    // Extrato do banco (mesma fonte do modo Sistema)
    let movBcoRows: any[] = [];
    if (filters.bankId) {
      const monthRanges = splitIntoMonths(dtaInicio, dtaFim);
      let allBankItems: any[] = [];
      for (const range of monthRanges) {
        try {
          const items = await fetchBankPages(filters.bankId, range.start, range.end);
          allBankItems = allBankItems.concat(items);
        } catch (err: any) {
          console.error(`[Conciliacao-Manual] Erro no mês ${range.start}: ${err.message}`);
        }
      }
      movBcoRows = allBankItems.map((item, idx) => {
        const dateObj = parseBrazilDate(item.transactionDate);
        return {
          COD_CHAVE: `api_${idx}`,
          DTA_ENTRADA: dateObj,
          FAVORECIDO: [item.transactionName, item.historicComplement].filter(Boolean).join(' - '),
          VAL_DOCTO: parseFloat(item.amount) || 0,
          TIPO_OPERACAO: item.creditDebitType === 'CREDITO' ? 0 : 1,
        };
      });
    }

    // Automática (texto) + por movimento (única/transferência). O movimento vence.
    const amarracoes = await ConciliacaoService.getAmarracoes(codLoja);
    const movimentos = await ConciliacaoService.getMovimentos(codLoja);

    let rowIdx = 0;
    const rows = movBcoRows.map((mb) => {
      const texto = mb.FAVORECIDO || '';
      const mk = movKeyOf(mb);
      let classificacao: any = null;
      if (movimentos[mk]) classificacao = movimentos[mk];
      else if (amarracoes[texto]) classificacao = { origem: 'automatica', ...amarracoes[texto] };
      return { rowId: `m${rowIdx++}`, banco: mb, texto_exato: texto, mov_key: mk, classificacao };
    });

    // Resumo
    const totalBanco = rows.length;
    const classificados = rows.filter(r => r.classificacao).length;
    const naoClassificados = totalBanco - classificados;
    const valEntradas = rows.filter(r => r.banco.TIPO_OPERACAO === 0)
      .reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);
    const valSaidas = rows.filter(r => r.banco.TIPO_OPERACAO === 1)
      .reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);

    return {
      rows,
      resumo: { totalBanco, classificados, naoClassificados, valEntradas, valSaidas },
    };
  }

  /**
   * Demonstrativo "Direto Manual": monta o relatório a partir do EXTRATO do banco
   * agrupado pelas amarrações (grupo -> conta), somando os valores.
   */
  static async getDemonstrativoManual(filters: ConciliacaoFilters): Promise<any> {
    const { rows } = await ConciliacaoService.getDadosManual(filters);

    // Agrupa por grupo -> conta usando a info da amarração
    const gruposMap = new Map<string, any>();
    let naoClassTotal = 0;
    let naoClassQtd = 0;

    for (const r of rows) {
      const val = Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0);
      const am = r.classificacao;
      if (!am) {
        naoClassTotal += val;
        naoClassQtd++;
        continue;
      }
      if (am.origem === 'transferencia') continue; // transferência não entra no DRE

      // Fatura: divide o movimento em vários itens (conta + valor). Demais: 1 conta com o valor cheio.
      const entries = am.origem === 'fatura'
        ? (am.itens || []).map((it: any) => ({
            plano_conta_id: it.plano_conta_id, conta_nome: it.conta_nome,
            grupo_nome: it.grupo_nome, is_receita: it.is_receita, v: Number(it.valor) || 0,
          }))
        : [{ plano_conta_id: am.plano_conta_id, conta_nome: am.conta_nome, grupo_nome: am.grupo_nome, is_receita: am.is_receita, v: val }];

      for (const e of entries) {
        const gKey = `${e.is_receita ? 'R' : 'D'}|${e.grupo_nome || '(sem grupo)'}`;
        let grupo = gruposMap.get(gKey);
        if (!grupo) {
          grupo = { nome: e.grupo_nome || '(sem grupo)', is_receita: !!e.is_receita, total: 0, contasMap: new Map() };
          gruposMap.set(gKey, grupo);
        }
        grupo.total += e.v;
        let conta = grupo.contasMap.get(e.plano_conta_id);
        if (!conta) {
          conta = { id: e.plano_conta_id, nome: e.conta_nome, valor: 0, qtd: 0, lancamentos: [] };
          grupo.contasMap.set(e.plano_conta_id, conta);
        }
        conta.valor += e.v;
        conta.qtd++;
        // Guarda o lancamento cru pro (+) da tela abrir e mostrar de onde veio
        // o total. Sem isso o usuario ve "R$ 19.554,46" e nao tem como conferir.
        conta.lancamentos.push({
          data: r.banco.DTA_ENTRADA,
          descricao: r.texto_exato || r.banco.FAVORECIDO || '',
          valor: e.v,
        });
      }
    }

    const grupos = Array.from(gruposMap.values())
      .map(g => ({
        nome: g.nome,
        is_receita: g.is_receita,
        total: g.total,
        contas: Array.from(g.contasMap.values())
          .map((c: any) => ({
            ...c,
            // Mais recente primeiro — é o que se quer ver ao abrir o (+)
            lancamentos: c.lancamentos.sort(
              (x: any, y: any) => new Date(y.data).getTime() - new Date(x.data).getTime(),
            ),
          }))
          .sort((a: any, b: any) => b.valor - a.valor),
      }))
      // Receitas primeiro, depois despesas; dentro, por valor desc
      .sort((a, b) => (a.is_receita === b.is_receita ? b.total - a.total : (a.is_receita ? -1 : 1)));

    const totalReceitas = grupos.filter(g => g.is_receita).reduce((s, g) => s + g.total, 0);
    const totalDespesas = grupos.filter(g => !g.is_receita).reduce((s, g) => s + g.total, 0);

    return {
      grupos,
      naoClassificado: { total: naoClassTotal, qtd: naoClassQtd },
      totais: {
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        totalNaoClassificado: naoClassTotal,
      },
    };
  }
}
