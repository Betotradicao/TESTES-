import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';


interface DVRSession {
  sessionId: string;
  loginTime: number;
}

interface POSSearchResult {
  Channel: string;
  ID: string;
  Time: string;
  cupom?: number;
  itens?: POSItem[];
  totalCupom?: number;
  qtdItens?: number;
}

interface POSItem {
  cod: string;
  descricao: string;
  qtd: number;
  unitario: number;
  total: number;
}

export class DVRCFTVService {
  private static session: DVRSession | null = null;
  private static SESSION_TTL = 5 * 60 * 1000; // 5 min

  /**
   * Obter config DVR do banco
   */
  private static async getConfig() {
    const configRepo = AppDataSource.getRepository(Configuration);
    const configs = await configRepo.find({
      where: [
        { key: 'dvr_ip' },
        { key: 'dvr_usuario' },
        { key: 'dvr_senha' },
        { key: 'dvr_porta_http' },
        { key: 'dvr_porta_rtsp' },
        { key: 'dvr_canais' },
        { key: 'dvr_canal_padrao' },
        { key: 'dvr_antecedencia_segundos' },
        { key: 'dvr_tempo_depois_segundos' }
      ]
    });
    const map: Record<string, string> = {};
    configs.forEach(c => { map[c.key] = c.value || ''; });

    // Parse canais JSON
    let canais: { channel: number; pdv: number; label: string }[] = [];
    try {
      if (map.dvr_canais) canais = JSON.parse(map.dvr_canais);
    } catch { /* ignore */ }

    // Detectar se estamos rodando fora do Docker (dev local na rede da loja)
    // Se sim, usar portas padrão do DVR (80/554) em vez das tuneladas (18080/18554)
    const isDocker = process.env.IS_DOCKER === 'true' || require('fs').existsSync('/.dockerenv');
    const rawHttpPort = parseInt(map.dvr_porta_http || '80');
    const rawRtspPort = map.dvr_porta_rtsp || '554';
    const httpPort = !isDocker && rawHttpPort > 10000 ? 80 : rawHttpPort;
    const rtspPort = !isDocker && parseInt(rawRtspPort) > 10000 ? '554' : rawRtspPort;

    // No Docker, o DVR é acessível via gateway Docker (172.20.0.1) pois o túnel SSH
    // escuta no host. O IP configurado (ex: 10.6.1.123) não é acessível do container.
    const dvrIp = isDocker && rawHttpPort > 10000 ? '172.20.0.1' : (map.dvr_ip || '');

    return {
      ip: dvrIp,
      user: map.dvr_usuario || 'admin',
      pass: map.dvr_senha || '',
      httpPort,
      rtspPort,
      canais,
      canalPadrao: parseInt(map.dvr_canal_padrao || '3'),
      antecedenciaSegundos: parseInt(map.dvr_antecedencia_segundos || '15'),
      tempoDepoisSegundos: parseInt(map.dvr_tempo_depois_segundos || '120')
    };
  }

  /**
   * Converte channel DVR para número do PDV usando mapeamento configurado
   */
  private static channelToPdv(config: Awaited<ReturnType<typeof DVRCFTVService.getConfig>>, channel: number): number {
    const entry = config.canais.find(c => c.channel === channel);
    if (entry) return entry.pdv;
    // Fallback: channel + 1
    return channel + 1;
  }

  /**
   * Converte channel DVR para canal RTSP (1-based)
   */
  private static channelToRtsp(channel: number): number {
    return channel + 1;
  }

  /**
   * Mapa padrão de finalizadoras (fallback quando Oracle não tem TAB_ENTIDADE)
   */
  private static readonly DEFAULT_FINALIZADORA_MAP: Record<number, string> = {
    1: 'DINHEIRO',
    2: 'CHEQUE A VISTA',
    3: 'CHEQUE PRE',
    4: 'FUNCIONARIO',
    5: 'CARTAO POS',
    6: 'CARTAO CREDITO',
    7: 'CARTAO DEBITO',
    8: 'BOLETO BANCARIO',
    9: 'PIX / CARTEIRA DIGITAL',
    10: 'SITEMERCADO / IFOOD',
    11: 'VALE TROCA',
    12: 'CARTAO PARCELADO',
    20: 'VALE COMPRA',
  };

  /**
   * Keywords comuns e seus sinônimos para busca de finalizadoras
   */
  private static readonly KEYWORD_SYNONYMS: Record<string, string[]> = {
    'DINHEIRO': ['DINHEIRO', 'ESPECIE', 'CASH'],
    'CHEQUE': ['CHEQUE'],
    'CARTAO CREDITO': ['CARTAO CREDITO', 'CREDITO', 'CREDIT'],
    'CARTAO DEBITO': ['CARTAO DEBITO', 'DEBITO', 'DEBIT'],
    'CARTAO PARCELADO': ['CARTAO PARCELADO', 'PARCELADO'],
    'CARTAO POS': ['CARTAO POS', 'POS'],
    'FUNCIONARIO': ['FUNCIONARIO'],
    'VALE COMPRA': ['VALE COMPRA', 'VALE', 'VOUCHER'],
    'CONVENIO': ['CONVENIO', 'CONVENIADO', 'FUNCIONARIO'],
    'PIX / CARTEIRA DIGITAL': ['PIX', 'CARTEIRA DIGITAL'],
  };

  /**
   * Buscar finalizadoras do Oracle (com cache e fallback)
   */
  private static finalizadoraCache: Record<number, string> | null = null;
  private static finalizadoraCacheTime = 0;

  private static async getFinalizadoraMap(): Promise<Record<number, string>> {
    // Cache por 10 minutos
    if (this.finalizadoraCache && (Date.now() - this.finalizadoraCacheTime) < 10 * 60 * 1000) {
      return this.finalizadoraCache;
    }
    try {
      const schema = await MappingService.getSchema();

      // 1) Tentar TAB_ENTIDADE (tem DES_ENTIDADE com nomes reais)
      try {
        const sql = `SELECT COD_ENTIDADE, DES_ENTIDADE FROM ${schema}.TAB_ENTIDADE ORDER BY COD_ENTIDADE`;
        const rows: any[] = await OracleService.query(sql, {});
        if (rows && rows.length > 0) {
          const map: Record<number, string> = {};
          for (const row of rows) {
            map[row.COD_ENTIDADE] = (row.DES_ENTIDADE || '').trim().toUpperCase();
          }
          this.finalizadoraCache = map;
          this.finalizadoraCacheTime = Date.now();
          console.log(`[DVR] Finalizadoras carregadas do Oracle (TAB_ENTIDADE): ${Object.keys(map).length} itens`, JSON.stringify(map));
          return map;
        }
      } catch {
        console.log('[DVR] TAB_ENTIDADE não existe, tentando TAB_FINALIZADORA...');
      }

      // 2) Tentar TAB_FINALIZADORA (fallback)
      try {
        const sql = `SELECT COD_FINALIZADORA, DES_FINALIZADORA FROM ${schema}.TAB_FINALIZADORA ORDER BY COD_FINALIZADORA`;
        const rows: any[] = await OracleService.query(sql, {});
        if (rows && rows.length > 0) {
          const map: Record<number, string> = {};
          for (const row of rows) {
            map[row.COD_FINALIZADORA] = (row.DES_FINALIZADORA || '').trim().toUpperCase();
          }
          this.finalizadoraCache = map;
          this.finalizadoraCacheTime = Date.now();
          console.log(`[DVR] Finalizadoras carregadas do Oracle (TAB_FINALIZADORA): ${Object.keys(map).length} itens`, JSON.stringify(map));
          return map;
        }
      } catch {
        console.log('[DVR] TAB_FINALIZADORA não existe, usando mapa padrão');
      }

      // 3) Último fallback: mapa padrão hardcoded
      console.log('[DVR] Usando mapa padrão de finalizadoras (fallback)');
      this.finalizadoraCache = { ...this.DEFAULT_FINALIZADORA_MAP };
      this.finalizadoraCacheTime = Date.now();
      return this.finalizadoraCache;
    } catch (e: any) {
      console.error('[DVR] Erro ao carregar finalizadoras:', e.message);
      return { ...this.DEFAULT_FINALIZADORA_MAP };
    }
  }

  /**
   * Encontra o código da finalizadora pelo nome (parcial), com suporte a sinônimos
   */
  private static async findFinalizadoraCod(keyword: string): Promise<number | null> {
    const map = await this.getFinalizadoraMap();
    const upper = keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Primeiro: buscar diretamente nas descrições do mapa
    for (const [cod, desc] of Object.entries(map)) {
      const descNorm = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (descNorm.includes(upper)) return Number(cod);
    }

    // Segundo: buscar via sinônimos
    for (const [finName, synonyms] of Object.entries(this.KEYWORD_SYNONYMS)) {
      const matched = synonyms.some(s => {
        const sNorm = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return sNorm.includes(upper) || upper.includes(sNorm);
      });
      if (matched) {
        // Encontrar código dessa finalizadora no mapa
        for (const [cod, desc] of Object.entries(map)) {
          const descNorm = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const finNorm = finName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (descNorm.includes(finNorm) || finNorm.includes(descNorm)) return Number(cod);
        }
      }
    }

    return null;
  }

  /**
   * RPC2 HTTP call
   */
  private static rpcCall(ip: string, urlPath: string, sessionId: string | null, method: string, params: any, id: number, port: number = 80): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ method, params, id, session: sessionId || undefined });
      const req = http.request({
        hostname: ip,
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'Cookie': 'DhWebClientSessionID=' + sessionId } : {})
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('RPC2 timeout')); });
      req.write(body);
      req.end();
    });
  }

  /**
   * Login RPC2 com challenge-response MD5
   */
  static async login(): Promise<string> {
    // Reusar sessão se válida
    if (this.session && (Date.now() - this.session.loginTime) < this.SESSION_TTL) {
      return this.session.sessionId;
    }

    const config = await this.getConfig();

    // Step 1: Get challenge
    const s1 = await this.rpcCall(config.ip, '/RPC2_Login', null, 'global.login', {
      userName: config.user, password: '', clientType: 'Web3.0', loginType: 'Direct'
    }, 1, config.httpPort);

    if (!s1.session || !s1.params?.realm || !s1.params?.random) {
      throw new Error('DVR login challenge failed');
    }

    const sessionId = s1.session;
    const realm = s1.params.realm;
    const random = s1.params.random;

    // Step 2: Calculate hash
    const h1 = crypto.createHash('md5').update(`${config.user}:${realm}:${config.pass}`).digest('hex').toUpperCase();
    const h2 = crypto.createHash('md5').update(`${config.user}:${random}:${h1}`).digest('hex').toUpperCase();

    // Step 3: Login with hash
    const s2 = await this.rpcCall(config.ip, '/RPC2_Login', sessionId, 'global.login', {
      userName: config.user, password: h2, clientType: 'Web3.0',
      loginType: 'Default', authorityType: 'Default'
    }, 2, config.httpPort);

    if (!s2.result) {
      throw new Error('DVR login failed: invalid credentials');
    }

    this.session = { sessionId, loginTime: Date.now() };
    return sessionId;
  }

  /**
   * Buscar TODOS os items POS do DVR dividindo em intervalos de 2h.
   * O DVR Dahua tem limite de 1024 items por doFind e ignora o offset.
   */
  private static async fetchAllDVRItems(
    config: Awaited<ReturnType<typeof DVRCFTVService.getConfig>>,
    sessionId: string,
    channel: number,
    startTime: string,
    endTime: string
  ): Promise<POSSearchResult[]> {
    // Extrair data base do startTime (ex: "2026-03-05 00:00:00" → "2026-03-05")
    const dateBase = startTime.split(' ')[0];

    // Dividir o dia em intervalos de 2h para ficar abaixo do limite de 1024
    const timeChunks: [string, string][] = [];
    for (let h = 0; h < 24; h += 2) {
      const chStart = `${dateBase} ${String(h).padStart(2, '0')}:00:00`;
      const chEnd = `${dateBase} ${String(h + 1).padStart(2, '0')}:59:59`;
      timeChunks.push([chStart, chEnd]);
    }

    let allItems: POSSearchResult[] = [];

    for (const [chStart, chEnd] of timeChunks) {
      try {
        const findResult = await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.startFind', {
          channel,
          condition: { StartTime: chStart, EndTime: chEnd, Text: '' }
        }, 10, config.httpPort);

        if (!findResult.result) {
          continue;
        }

        const token = findResult.params.token;
        const chunkCount = findResult.params.totalCount || 0;

        if (chunkCount === 0) {
          await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.stopFind', { token }, 12, config.httpPort);
          continue;
        }

        // Buscar até 2000 items (bem acima do limite de 1024)
        const results = await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.doFind', {
          token, count: 2000, offset: 0
        }, 11, config.httpPort);
        const items = results.params?.info || [];

        // Log sample para investigar campos do DVR
        if (allItems.length === 0 && items.length > 0) {
          console.log(`[DVR] Sample item keys:`, Object.keys(items[0]));
          if (items[0].Data) console.log(`[DVR] Sample Data (first 300):`, items[0].Data.substring(0, 300));
          if (items[0].Text) console.log(`[DVR] Sample Text (first 300):`, items[0].Text.substring(0, 300));
        }

        await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.stopFind', { token }, 12, config.httpPort);

        allItems = allItems.concat(items);
      } catch (err: any) {
        console.log(`[DVR] Erro no chunk ${chStart}-${chEnd}: ${err.message}`);
      }
    }

    return allItems;
  }

  /**
   * Buscar transações POS por texto
   */
  static async searchPOS(channel: number, startTime: string, endTime: string, text: string): Promise<{ total: number; items: POSSearchResult[] }> {
    const config = await this.getConfig();
    const sessionId = await this.login();

    // O DVR Dahua tem limite de 1024 items por doFind e ignora o parâmetro offset.
    // Solução: dividir a busca em intervalos de 2 horas para garantir < 1024 por chunk.
    const allItems = await this.fetchAllDVRItems(config, sessionId, channel, startTime, endTime);
    console.log(`[DVR] Total transações DVR: ${allItems.length}`);

    try {
      const pdv = this.channelToPdv(config, channel);

      // Sem texto de busca → retornar tudo do DVR enriquecido com cupom
      if (!text || !text.trim()) {
        const enriched = await this.enrichWithCupomNumbers(allItems, pdv);
        return { total: allItems.length, items: enriched };
      }

      // COM texto de busca → filtrar via Oracle (buscar cupons que contêm o produto/palavra)
      console.log(`[DVR] Filtrando por "${text}" via Oracle...`);
      const matchingLines = await this.findCupomsByText(pdv, startTime, endTime, text.trim());
      console.log(`[DVR] Oracle encontrou ${matchingLines.length} linhas com "${text}"`);

      if (matchingLines.length === 0) {
        return { total: 0, items: [] };
      }

      // Cruzar timestamps DVR com linhas Oracle (±90s, match 1:1)
      const filtered = this.matchDVRWithCupoms(allItems, matchingLines);
      console.log(`[DVR] ${filtered.length} transações DVR correspondem a cupons com "${text}"`);

      return { total: filtered.length, items: filtered };
    } catch (err: any) {
      console.error('[DVR] Erro ao filtrar:', err.message);
      // Fallback: retornar tudo sem filtro
      return { total: allItems.length, items: allItems };
    }
  }

  /**
   * Buscar no Oracle quais cupons contêm determinado texto (produto, finalizadora, cancelado, desconto)
   * Retorna Map<cupomNum, { time: string, cupomNum: number }>
   */
  private static async findCupomsByText(pdv: number, startTime: string, _endTime: string, text: string): Promise<{ time: string; cupomNum: number; totalUnits: number }[]> {
    const datePart = startTime.split(' ')[0];
    const [year, month, day] = datePart.split('-');
    const dateStr = `${day}/${month}/${year}`;
    const textUpper = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const schema = await MappingService.getSchema();

    // Detectar palavras-chave especiais
    let keyword = '';
    if (['CANCELAMENTO', 'CANCELADO', 'CANCEL', 'CANCELA', 'ESTORNO'].includes(textUpper)) {
      keyword = 'cancelado';
    } else if (textUpper === 'DESCONTO') {
      keyword = 'desconto';
    } else if (['BUSCA', 'BUSCA PRECO', 'CONSULTA', 'CONSULTA PRECO'].includes(textUpper)) {
      keyword = 'busca_preco';
    } else {
      const codFin = await this.findFinalizadoraCod(textUpper);
      if (codFin) keyword = `fin_${codFin}`;
    }

    const results: { time: string; cupomNum: number; totalUnits: number }[] = [];

    // CANCELAMENTO/ESTORNO → buscar na TAB_PRODUTO_PDV_ESTORNO
    if (keyword === 'cancelado') {
      const sql = `
        SELECT e.NUM_CUPOM_FISCAL,
               TO_CHAR(e.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(e.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
               1 as TOTAL_UNITS
        FROM ${schema}.TAB_PRODUTO_PDV_ESTORNO e
        WHERE e.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND e.NUM_PDV = :pdv
        ORDER BY e.TIM_HORA
      `;
      try {
        const rows = await OracleService.query(sql, { dateStr, pdv });
        for (const row of rows) {
          results.push({
            time: row.HORA_CUPOM || '',
            cupomNum: Number(row.NUM_CUPOM_FISCAL),
            totalUnits: 1
          });
        }
      } catch (err: any) {
        console.error('[DVR] Erro Oracle estornos:', err.message);
      }
      return results;
    }

    // BUSCA PREÇO → buscar itens com NUM_CUPOM_FISCAL = 0 (consultas de preço)
    if (keyword === 'busca_preco') {
      const sql = `
        SELECT 0 as NUM_CUPOM_FISCAL,
               TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
               1 as TOTAL_UNITS
        FROM ${schema}.TAB_PRODUTO_PDV p
        WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND p.NUM_PDV = :pdv
          AND p.NUM_CUPOM_FISCAL = 0
        ORDER BY p.TIM_HORA
      `;
      try {
        const rows = await OracleService.query(sql, { dateStr, pdv });
        for (const row of rows) {
          results.push({
            time: row.HORA_CUPOM || '',
            cupomNum: 0,
            totalUnits: 1
          });
        }
      } catch (err: any) {
        console.error('[DVR] Erro Oracle busca preco:', err.message);
      }
      return results;
    }

    // DESCONTO, FINALIZADORA ou PRODUTO → buscar na TAB_PRODUTO_PDV
    let whereExtra = '';
    let params: any = { dateStr, pdv };

    if (keyword === 'desconto') {
      whereExtra = `AND p.VAL_DESCONTO > 0`;
    } else if (keyword.startsWith('fin_')) {
      const codFin = parseInt(keyword.split('_')[1]);
      whereExtra = `AND EXISTS (
        SELECT 1 FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
        WHERE cf.DTA_VENDA = p.DTA_SAIDA AND cf.NUM_PDV = p.NUM_PDV
          AND cf.NUM_CUPOM_FISCAL = p.NUM_CUPOM_FISCAL AND cf.COD_FINALIZADORA = :codFin
      )`;
      params.codFin = codFin;
    } else {
      // Buscar por nome de produto
      whereExtra = `AND UPPER(pr.DES_PRODUTO) LIKE '%' || UPPER(:text) || '%'`;
      params.text = text;
    }

    // Para busca por PRODUTO: somar QTD (DVR imprime 1 linha por unidade)
    // Para finalizadora/desconto: 1 por cupom (a palavra aparece só 1x no recibo)
    const isProductSearch = !keyword;
    const unitsExpr = isProductSearch
      ? `SUM(CASE WHEN p.QTD_TOTAL_PRODUTO >= 1 THEN FLOOR(p.QTD_TOTAL_PRODUTO) ELSE 1 END)`
      : `1`;

    const sql = `
      SELECT p.NUM_CUPOM_FISCAL,
             TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(MIN(p.TIM_HORA), 'HH24:MI:SS') as HORA_CUPOM,
             ${unitsExpr} as TOTAL_UNITS
      FROM ${schema}.TAB_PRODUTO_PDV p
      LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
      WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
        AND p.NUM_PDV = :pdv
        AND p.NUM_CUPOM_FISCAL > 0
        ${whereExtra}
      GROUP BY p.NUM_CUPOM_FISCAL, p.DTA_SAIDA
      ORDER BY MIN(p.TIM_HORA)
    `;

    try {
      const rows = await OracleService.query(sql, params);
      for (const row of rows) {
        const cupomNum = Number(row.NUM_CUPOM_FISCAL);
        if (cupomNum > 0) {
          results.push({
            time: row.HORA_CUPOM || '',
            cupomNum,
            totalUnits: Math.max(Number(row.TOTAL_UNITS) || 1, 1)
          });
        }
      }
    } catch (err: any) {
      console.error('[DVR] Erro Oracle findCupomsByText:', err.message);
    }

    return results;
  }

  /**
   * Cruzar transações DVR com cupons Oracle por janela de tempo.
   * Para cada cupom, captura N items DVR mais próximos (N = totalUnits).
   */
  private static matchDVRWithCupoms(dvrItems: POSSearchResult[], oracleCupoms: { time: string; cupomNum: number; totalUnits: number }[]): POSSearchResult[] {
    // Converter cupons Oracle em timestamps
    const cupomEntries: { time: Date; cupomNum: number; totalUnits: number }[] = [];
    for (const entry of oracleCupoms) {
      try {
        const t = new Date(entry.time.replace(' ', 'T'));
        if (!isNaN(t.getTime())) {
          cupomEntries.push({ time: t, cupomNum: entry.cupomNum, totalUnits: entry.totalUnits });
        }
      } catch { /* skip */ }
    }

    console.log(`[DVR] matchDVRWithCupoms: ${dvrItems.length} DVR items, ${cupomEntries.length} cupons Oracle`);

    const matched: POSSearchResult[] = [];
    const usedDVRIndices = new Set<number>();
    const TOLERANCE = 120_000; // ±2 minutos

    // Para cada cupom Oracle, pegar os N DVR items mais próximos
    for (const ce of cupomEntries) {
      // Encontrar DVR items próximos, ordenados por distância
      const candidates: { idx: number; diff: number; item: POSSearchResult }[] = [];
      for (let i = 0; i < dvrItems.length; i++) {
        if (usedDVRIndices.has(i)) continue;
        const dvrTime = new Date(dvrItems[i].Time.replace(' ', 'T'));
        if (isNaN(dvrTime.getTime())) continue;
        const diff = Math.abs(dvrTime.getTime() - ce.time.getTime());
        if (diff <= TOLERANCE) {
          candidates.push({ idx: i, diff, item: dvrItems[i] });
        }
      }

      // Ordenar por proximidade e pegar os N mais próximos
      candidates.sort((a, b) => a.diff - b.diff);
      const toTake = Math.min(ce.totalUnits, candidates.length);

      for (let j = 0; j < toTake; j++) {
        usedDVRIndices.add(candidates[j].idx);
        matched.push({ ...candidates[j].item, cupom: ce.cupomNum });
      }
    }

    return matched;
  }

  /**
   * Buscar transações no Oracle por texto/palavra-chave e retornar no formato DVR
   */
  private static async searchByOracleText(pdv: number, startTime: string, endTime: string, text: string, channel: number): Promise<POSSearchResult[]> {
    const datePart = startTime.split(' ')[0];
    const [year, month, day] = datePart.split('-');
    const dateStr = `${day}/${month}/${year}`;
    const textUpper = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const schema = await MappingService.getSchema();

    // Palavras-chave especiais - buscar finalizadoras dinamicamente
    let keyword = '';
    if (['CANCELAMENTO', 'CANCELADO', 'CANCEL'].includes(textUpper)) {
      keyword = 'cancelado';
    } else if (textUpper === 'DESCONTO') {
      keyword = 'desconto';
    } else {
      // Tentar encontrar finalizadora pelo nome
      const codFin = await this.findFinalizadoraCod(textUpper);
      if (codFin !== null) {
        keyword = `fin_${codFin}`;
      }
    }

    let whereExtra = '';
    let params: any = { dateStr, pdv };

    if (keyword === 'cancelado') {
      whereExtra = `AND p.FLG_CUPOM_CANCELADO = 'S'`;
    } else if (keyword === 'desconto') {
      whereExtra = `AND p.VAL_DESCONTO > 0`;
    } else if (keyword.startsWith('fin_')) {
      const codFin = parseInt(keyword.split('_')[1]);
      whereExtra = `AND EXISTS (
        SELECT 1 FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
        WHERE cf.DTA_VENDA = p.DTA_SAIDA AND cf.NUM_PDV = p.NUM_PDV
          AND cf.NUM_CUPOM_FISCAL = p.NUM_CUPOM_FISCAL AND cf.COD_FINALIZADORA = :codFin
      )`;
      params.codFin = codFin;
    } else {
      whereExtra = `AND UPPER(pr.DES_PRODUTO) LIKE '%' || UPPER(:text) || '%'`;
      params.text = text;
    }

    const sql = `
      SELECT DISTINCT p.NUM_CUPOM_FISCAL, TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') HORA,
             TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') DTA
      FROM ${schema}.TAB_PRODUTO_PDV p
      LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
      WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
        AND p.NUM_PDV = :pdv
        AND p.NUM_CUPOM_FISCAL > 0
        ${whereExtra}
      ORDER BY HORA
    `;

    const rows: any[] = await OracleService.query(sql, params);
    if (!rows || rows.length === 0) return [];

    // Agrupar por cupom (cada cupom = 1 transação na lista)
    const seen = new Set<number>();
    const items: POSSearchResult[] = [];

    for (const row of rows) {
      const cupomNum = row.NUM_CUPOM_FISCAL;
      if (seen.has(cupomNum)) continue;
      seen.add(cupomNum);

      items.push({
        Channel: String(channel),
        ID: `oracle_${cupomNum}`,
        Time: `${row.DTA} ${row.HORA}`,
        cupom: cupomNum,
      });
    }

    return items;
  }

  /**
   * Busca Oracle por palavra-chave em TODOS os PDVs (sem usar DVR POS).
   * Retorna transações com PDV, horário, cupom, operador, valor e tipo.
   */
  static async searchOracleAllPdvs(startDate: string, endDate: string, text: string, pdvFilter?: number, barcode?: string): Promise<{ total: number; items: any[] }> {
    const [year, month, day] = startDate.split('-');
    const dateStr = `${day}/${month}/${year}`;
    const textUpper = text ? text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
    const schema = await MappingService.getSchema();

    // Se barcode fornecido, buscar vendas por código de barras
    if (barcode) {
      return this.searchByBarcode(schema, dateStr, barcode, pdvFilter);
    }

    // Detectar palavras-chave especiais
    let keyword = '';
    if (['CANCELAMENTO ITEM', 'CANCELADO ITEM', 'CANC ITEM', 'CANC. ITEM'].includes(textUpper)) {
      keyword = 'cancelado_item';
    } else if (['CANCELAMENTO CUPOM', 'CANCELADO CUPOM', 'CANC CUPOM', 'CANC. CUPOM'].includes(textUpper)) {
      keyword = 'cancelado_cupom';
    } else if (['CANCELAMENTO VENDA', 'CANCELADO VENDA', 'CANC VENDA', 'CANC. VENDA'].includes(textUpper)) {
      keyword = 'cancelado_venda';
    } else if (['CANCELAMENTO', 'CANCELADO', 'CANCEL', 'CANCELA', 'ESTORNO'].includes(textUpper)) {
      keyword = 'cancelado';
    } else if (textUpper === 'DESCONTO') {
      keyword = 'desconto';
    } else if (['BUSCA', 'BUSCA PRECO', 'CONSULTA', 'CONSULTA PRECO'].includes(textUpper)) {
      keyword = 'busca_preco';
    } else {
      const codFin = await this.findFinalizadoraCod(textUpper);
      if (codFin !== null) keyword = `fin_${codFin}`;
    }

    const results: any[] = [];
    let params: any = { dateStr };
    if (pdvFilter) params.pdv = pdvFilter;
    const pdvWhere = pdvFilter ? 'AND p.NUM_PDV = :pdv' : '';
    const pdvWhereE = pdvFilter ? 'AND e.NUM_PDV = :pdv' : '';

    // CANCELAMENTO DE ITEM → TAB_PRODUTO_PDV_ESTORNO com operador (venda finalizada, item cancelado)
    if (keyword === 'cancelado_item' || keyword === 'cancelado') {
      const sqlItem = `
        SELECT e.NUM_CUPOM_FISCAL, e.NUM_PDV,
               TO_CHAR(e.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(e.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
               pr.DES_PRODUTO,
               e.VAL_TOTAL_PRODUTO as VALOR,
               (SELECT op2.DES_OPERADOR
                FROM ${schema}.TAB_CUPOM_FINALIZADORA cf2
                LEFT JOIN ${schema}.TAB_OPERADORES op2 ON op2.COD_OPERADOR = cf2.COD_OPERADOR
                WHERE cf2.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL AND cf2.NUM_PDV = e.NUM_PDV
                  AND TRUNC(cf2.DTA_VENDA) = TRUNC(e.DTA_SAIDA) AND cf2.COD_OPERADOR IS NOT NULL AND ROWNUM = 1) as NOM_OPERADOR
        FROM ${schema}.TAB_PRODUTO_PDV_ESTORNO e
        LEFT JOIN ${schema}.TAB_PRODUTO pr ON e.COD_PRODUTO = pr.COD_PRODUTO
        WHERE e.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          ${pdvWhereE}
          AND EXISTS (
            SELECT 1 FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
            WHERE cf.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
              AND cf.NUM_PDV = e.NUM_PDV
              AND TRUNC(cf.DTA_VENDA) = TRUNC(e.DTA_SAIDA)
          )
        ORDER BY e.TIM_HORA
      `;
      const rows = await OracleService.query(sqlItem, params);
      for (const row of rows) {
        results.push({
          time: row.HORA_CUPOM, cupomNum: Number(row.NUM_CUPOM_FISCAL),
          pdv: Number(row.NUM_PDV), produto: row.DES_PRODUTO || '',
          valor: Number(row.VALOR) || 0, tipo: 'CANC. ITEM',
          operador: (row.NOM_OPERADOR || '').trim()
        });
      }
      if (keyword === 'cancelado_item') return { total: results.length, items: results };
    }

    // CANCELAMENTO DE CUPOM → TAB_CUPOM_CANCELADO (cupom inteiro cancelado após pagamento)
    if (keyword === 'cancelado_cupom' || keyword === 'cancelado') {
      const sqlCupom = `
        SELECT cc.NUM_SEQ as NUM_CUPOM_FISCAL, cc.NUM_PDV,
               TO_CHAR(cc.DTA_SEQ, 'YYYY-MM-DD') || ' ' ||
               NVL(
                 (SELECT TO_CHAR(MIN(cf_h.HORA_MOV), 'HH24:MI:SS')
                  FROM ${schema}.TAB_CUPOM_FINALIZADORA cf_h
                  WHERE cf_h.NUM_PDV = cc.NUM_PDV
                    AND TRUNC(cf_h.DTA_VENDA) = TRUNC(cc.DTA_SEQ)
                    AND ABS(cf_h.NUM_CUPOM_FISCAL - cc.NUM_SEQ) <= 1),
                 '00:00:00') as HORA_CUPOM,
               NULL as DES_PRODUTO,
               NVL(ABS(
                 (SELECT SUM(cf_val.VAL_LIQUIDO)
                  FROM ${schema}.TAB_CUPOM_FINALIZADORA cf_val
                  WHERE cf_val.NUM_CUPOM_FISCAL = cc.NUM_SEQ + 1
                    AND cf_val.NUM_PDV = cc.NUM_PDV
                    AND TRUNC(cf_val.DTA_VENDA) = TRUNC(cc.DTA_SEQ))
               ), 0) as VALOR
        FROM ${schema}.TAB_CUPOM_CANCELADO cc
        WHERE cc.DTA_SEQ = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND cc.FLG_ESTORNO = 'S'
          ${pdvFilter ? 'AND cc.NUM_PDV = :pdv' : ''}
      `;
      try {
        const rows = await OracleService.query(sqlCupom, params);
        for (const row of rows) {
          results.push({
            time: row.HORA_CUPOM, cupomNum: Number(row.NUM_CUPOM_FISCAL),
            pdv: Number(row.NUM_PDV), produto: '',
            valor: Number(row.VALOR) || 0, tipo: 'CANC. CUPOM',
            operador: ''
          });
        }
      } catch (e: any) {
        console.log(`[VISION-PC2] TAB_CUPOM_CANCELADO não disponível: ${e.message}`);
      }
      if (keyword === 'cancelado_cupom') return { total: results.length, items: results };
    }

    // CANCELAMENTO DE VENDA → TAB_PRODUTO_PDV_ESTORNO sem operador (venda cancelada antes do pagamento)
    if (keyword === 'cancelado_venda' || keyword === 'cancelado') {
      const sqlVenda = `
        SELECT e.NUM_CUPOM_FISCAL, e.NUM_PDV,
               TO_CHAR(e.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(e.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
               pr.DES_PRODUTO,
               e.VAL_TOTAL_PRODUTO as VALOR
        FROM ${schema}.TAB_PRODUTO_PDV_ESTORNO e
        LEFT JOIN ${schema}.TAB_PRODUTO pr ON e.COD_PRODUTO = pr.COD_PRODUTO
        WHERE e.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          ${pdvWhereE}
          AND NOT EXISTS (
            SELECT 1 FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
            WHERE cf.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
              AND cf.NUM_PDV = e.NUM_PDV
              AND TRUNC(cf.DTA_VENDA) = TRUNC(e.DTA_SAIDA)
          )
        ORDER BY e.TIM_HORA
      `;
      const rows = await OracleService.query(sqlVenda, params);
      for (const row of rows) {
        results.push({
          time: row.HORA_CUPOM, cupomNum: Number(row.NUM_CUPOM_FISCAL),
          pdv: Number(row.NUM_PDV), produto: row.DES_PRODUTO || '',
          valor: Number(row.VALOR) || 0, tipo: 'CANC. VENDA',
          operador: (row.NOM_OPERADOR || '').trim()
        });
      }
      if (keyword === 'cancelado_venda') return { total: results.length, items: results };
    }

    // Se era 'cancelado' genérico, retorna todos os tipos juntos
    if (keyword === 'cancelado') {
      results.sort((a, b) => a.time.localeCompare(b.time));
      return { total: results.length, items: results };
    }

    // BUSCA PREÇO
    if (keyword === 'busca_preco') {
      const sql = `
        SELECT 0 as NUM_CUPOM_FISCAL, p.NUM_PDV,
               TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
               pr.DES_PRODUTO, p.VAL_TOTAL_PRODUTO as VALOR,
               'BUSCA PRECO' as TIPO
        FROM ${schema}.TAB_PRODUTO_PDV p
        LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
        WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND p.NUM_CUPOM_FISCAL = 0
          ${pdvWhere}
        ORDER BY p.TIM_HORA
      `;
      const rows = await OracleService.query(sql, params);
      for (const row of rows) {
        results.push({
          time: row.HORA_CUPOM, cupomNum: 0,
          pdv: Number(row.NUM_PDV), produto: row.DES_PRODUTO || '',
          valor: Number(row.VALOR) || 0, tipo: 'BUSCA PRECO',
          operador: (row.NOM_OPERADOR || '').trim()
        });
      }
      return { total: results.length, items: results };
    }

    // DESCONTO, FINALIZADORA ou PRODUTO
    let whereExtra = '';
    if (keyword === 'desconto') {
      whereExtra = `AND p.VAL_DESCONTO > 0`;
    } else if (keyword.startsWith('fin_')) {
      const codFin = parseInt(keyword.split('_')[1]);
      whereExtra = `AND EXISTS (
        SELECT 1 FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
        WHERE cf.DTA_VENDA = p.DTA_SAIDA AND cf.NUM_PDV = p.NUM_PDV
          AND cf.NUM_CUPOM_FISCAL = p.NUM_CUPOM_FISCAL AND cf.COD_FINALIZADORA = :codFin
      )`;
      params.codFin = codFin;
    } else {
      whereExtra = `AND UPPER(pr.DES_PRODUTO) LIKE '%' || UPPER(:text) || '%'`;
      params.text = text;
    }

    const tipoLabel = keyword === 'desconto' ? 'DESCONTO' : keyword.startsWith('fin_') ? 'FINALIZADORA' : 'PRODUTO';

    const sql = `
      SELECT sub.NUM_CUPOM_FISCAL, sub.NUM_PDV, sub.HORA_CUPOM, sub.VALOR, sub.QTD_ITENS,
             op.DES_OPERADOR as NOM_OPERADOR
      FROM (
        SELECT p.NUM_CUPOM_FISCAL, p.NUM_PDV, p.DTA_SAIDA,
               TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(MIN(p.TIM_HORA), 'HH24:MI:SS') as HORA_CUPOM,
               SUM(p.VAL_TOTAL_PRODUTO) as VALOR,
               COUNT(*) as QTD_ITENS,
               (SELECT MAX(cf2.COD_OPERADOR) FROM ${schema}.TAB_CUPOM_FINALIZADORA cf2
                WHERE cf2.NUM_CUPOM_FISCAL = p.NUM_CUPOM_FISCAL AND cf2.NUM_PDV = p.NUM_PDV
                  AND TRUNC(cf2.DTA_VENDA) = TRUNC(p.DTA_SAIDA)) as COD_OPERADOR
        FROM ${schema}.TAB_PRODUTO_PDV p
        LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
        WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND p.NUM_CUPOM_FISCAL > 0
          ${pdvWhere}
          ${whereExtra}
        GROUP BY p.NUM_CUPOM_FISCAL, p.NUM_PDV, p.DTA_SAIDA
      ) sub
      LEFT JOIN ${schema}.TAB_OPERADORES op ON op.COD_OPERADOR = sub.COD_OPERADOR
      ORDER BY sub.HORA_CUPOM
    `;

    const rows = await OracleService.query(sql, params);
    for (const row of rows) {
      results.push({
        time: row.HORA_CUPOM, cupomNum: Number(row.NUM_CUPOM_FISCAL),
        pdv: Number(row.NUM_PDV), produto: '',
        valor: Number(row.VALOR) || 0, tipo: tipoLabel,
        qtdItens: Number(row.QTD_ITENS) || 0,
        operador: (row.NOM_OPERADOR || '').trim()
      });
    }

    return { total: results.length, items: results };
  }

  /**
   * Buscar produto pelo código de barras (EAN)
   */
  static async findProductByBarcode(barcode: string): Promise<{ found: boolean; produto?: string; codProduto?: number }> {
    const schema = await MappingService.getSchema();
    const sql = `SELECT COD_PRODUTO, DES_PRODUTO FROM ${schema}.TAB_PRODUTO WHERE COD_BARRA_PRINCIPAL = :barcode AND ROWNUM = 1`;
    const rows = await OracleService.query(sql, { barcode });
    if (rows.length > 0) {
      return { found: true, produto: rows[0].DES_PRODUTO, codProduto: Number(rows[0].COD_PRODUTO) };
    }
    return { found: false };
  }

  /**
   * Buscar vendas por código de barras (EAN) do produto
   */
  private static async searchByBarcode(schema: string, dateStr: string, barcode: string, pdvFilter?: number): Promise<{ total: number; items: any[] }> {
    const params: any = { dateStr, barcode };
    if (pdvFilter) params.pdv = pdvFilter;
    const pdvWhere = pdvFilter ? 'AND p.NUM_PDV = :pdv' : '';

    const sql = `
      SELECT p.NUM_CUPOM_FISCAL, p.NUM_PDV,
             TO_CHAR(p.DTA_SAIDA, 'YYYY-MM-DD') || ' ' || TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') as HORA_CUPOM,
             pr.DES_PRODUTO, p.VAL_TOTAL_PRODUTO as VALOR,
             p.QTD_PRODUTO as QTD,
             'PRODUTO' as TIPO,
             (SELECT op2.DES_OPERADOR FROM ${schema}.TAB_CUPOM_FINALIZADORA cf2
              LEFT JOIN ${schema}.TAB_OPERADORES op2 ON op2.COD_OPERADOR = cf2.COD_OPERADOR
              WHERE cf2.NUM_CUPOM_FISCAL = p.NUM_CUPOM_FISCAL AND cf2.NUM_PDV = p.NUM_PDV
                AND TRUNC(cf2.DTA_VENDA) = TRUNC(p.DTA_SAIDA) AND cf2.COD_OPERADOR IS NOT NULL AND ROWNUM = 1) as NOM_OPERADOR
      FROM ${schema}.TAB_PRODUTO_PDV p
      JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
      WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
        AND p.NUM_CUPOM_FISCAL > 0
        AND pr.COD_BARRA_PRINCIPAL = :barcode
        ${pdvWhere}
      ORDER BY p.TIM_HORA
    `;

    console.log(`[VISION-PC2] Busca por barcode: ${barcode}`);
    const rows = await OracleService.query(sql, params);
    const results = rows.map((row: any) => ({
      time: row.HORA_CUPOM,
      cupomNum: Number(row.NUM_CUPOM_FISCAL),
      pdv: Number(row.NUM_PDV),
      produto: row.DES_PRODUTO || '',
      valor: Number(row.VALOR) || 0,
      tipo: 'PRODUTO',
      qtdItens: Number(row.QTD) || 1,
      operador: (row.NOM_OPERADOR || '').trim()
    }));

    return { total: results.length, items: results };
  }

  /**
   * Enriquecer resultados DVR com número do cupom do Oracle
   */
  private static async enrichWithCupomNumbers(items: POSSearchResult[], pdv: number): Promise<POSSearchResult[]> {
    if (!items || items.length === 0) return items;

    // Extrair data e range de horários
    const times = items.map(i => i.Time).filter(Boolean);
    if (times.length === 0) return items;

    // Pegar data do primeiro item (formato: "2026-03-04 17:24:12")
    const firstDate = times[0].split(' ')[0]; // "2026-03-04"
    const [year, month, day] = firstDate.split('-');
    const dateStr = `${day}/${month}/${year}`;

    // Buscar todos os cupons do período no Oracle (agrupados por hora:minuto)
    const schema = await MappingService.getSchema();
    const sql = `
      SELECT DISTINCT NUM_CUPOM_FISCAL, TO_CHAR(TIM_HORA, 'HH24:MI:SS') HORA
      FROM ${schema}.TAB_PRODUTO_PDV
      WHERE DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
        AND NUM_PDV = :pdv
        AND NUM_CUPOM_FISCAL > 0
      ORDER BY HORA
    `;

    const rows: any[] = await OracleService.query(sql, { dateStr, pdv });
    if (!rows || rows.length === 0) return items;

    // Criar mapa de hora:minuto -> cupom
    const cupomMap: Record<string, number> = {};
    for (const row of rows) {
      const hora = row.HORA; // "17:24:12"
      const hm = hora?.substring(0, 5); // "17:24"
      if (hm && !cupomMap[hm]) {
        cupomMap[hm] = row.NUM_CUPOM_FISCAL;
      }
    }

    // Enriquecer cada item
    return items.map(item => {
      if (!item.Time) return item;
      const timePart = item.Time.split(' ')[1]; // "17:24:12"
      if (!timePart) return item;
      const hm = timePart.substring(0, 5); // "17:24"
      const cupom = cupomMap[hm];
      if (cupom) {
        return { ...item, cupom };
      }
      return item;
    });
  }

  /**
   * Buscar itens do cupom no Oracle pelo número do cupom ou timestamp da transação DVR
   */
  static async getCupomByTime(time: string, channel: number, cupomNumDirect?: number): Promise<any> {
    try {
      const config = await this.getConfig();
      const pdv = this.channelToPdv(config, channel);
      // time = "2026-03-04 17:24:12"
      const [datePart, timePart] = time.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const dateStr = `${day}/${month}/${year}`;

      const schema = await MappingService.getSchema();
      let rows: any[];

      if (cupomNumDirect) {
        // Busca DIRETA por número do cupom (preciso e correto)
        const sql = `
          SELECT p.NUM_CUPOM_FISCAL, TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') HORA,
                 p.COD_PRODUTO, pr.DES_PRODUTO, p.QTD_TOTAL_PRODUTO QTD,
                 p.VAL_PRECO_VENDA UNITARIO, p.VAL_TOTAL_PRODUTO TOTAL,
                 p.VAL_DESCONTO, p.FLG_CUPOM_CANCELADO,
                 p.COD_ENTIDADE, p.NUM_SEQ_ITEM
          FROM ${schema}.TAB_PRODUTO_PDV p
          LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
          WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
            AND p.NUM_PDV = :pdv
            AND p.NUM_CUPOM_FISCAL = :cupomNum
          ORDER BY p.NUM_SEQ_ITEM
        `;
        console.log(`[DVR] getCupomDirect: date=${dateStr}, pdv=${pdv}, cupom=${cupomNumDirect}`);
        rows = await OracleService.query(sql, { dateStr, pdv, cupomNum: cupomNumDirect });
      } else {
        // Fallback: busca por horário (±1 minuto de tolerância)
        const minBefore = parseInt(minute) > 0 ? parseInt(minute) - 1 : 0;
        const minAfter = parseInt(minute) < 59 ? parseInt(minute) + 1 : 59;
        const hourPad = hour.padStart(2, '0');

        const sql = `
          SELECT p.NUM_CUPOM_FISCAL, TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') HORA,
                 p.COD_PRODUTO, pr.DES_PRODUTO, p.QTD_TOTAL_PRODUTO QTD,
                 p.VAL_PRECO_VENDA UNITARIO, p.VAL_TOTAL_PRODUTO TOTAL,
                 p.VAL_DESCONTO, p.FLG_CUPOM_CANCELADO,
                 p.COD_ENTIDADE, p.NUM_SEQ_ITEM
          FROM ${schema}.TAB_PRODUTO_PDV p
          LEFT JOIN ${schema}.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
          WHERE p.DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
            AND p.NUM_PDV = :pdv
            AND TO_CHAR(p.TIM_HORA, 'HH24') = :hour
            AND TO_NUMBER(TO_CHAR(p.TIM_HORA, 'MI')) BETWEEN :minBefore AND :minAfter
            AND p.NUM_CUPOM_FISCAL > 0
          ORDER BY p.NUM_CUPOM_FISCAL, p.NUM_SEQ_ITEM
        `;
        console.log(`[DVR] getCupomByTime: date=${dateStr}, pdv=${pdv}, hour=${hourPad}, minBefore=${minBefore}, minAfter=${minAfter}`);
        rows = await OracleService.query(sql, { dateStr, pdv, hour: hourPad, minBefore, minAfter });
      }

      console.log(`[DVR] getCupom: ${rows?.length || 0} rows encontrados`);

      if (!rows || rows.length === 0) return null;

      // Agrupar por cupom
      const cupons: Record<number, any[]> = {};
      for (const row of rows) {
        const num = row.NUM_CUPOM_FISCAL;
        if (!cupons[num]) cupons[num] = [];
        cupons[num].push(row);
      }

      // Se veio direto, usar esse. Se não, pegar o primeiro.
      const cupomNum = cupomNumDirect || Object.keys(cupons).map(Number)[0];
      const cupomRows = cupons[cupomNum];

      const itens: POSItem[] = cupomRows.map((r: any) => ({
        cod: r.COD_PRODUTO,
        descricao: (r.DES_PRODUTO || 'PRODUTO').trim(),
        qtd: Number(r.QTD) || 0,
        unitario: Number(r.UNITARIO) || 0,
        total: Number(r.TOTAL) || 0,
      }));

      const totalCupom = itens.reduce((s, i) => s + i.total, 0);

      // Buscar nome do operador via TAB_CUPOM_FINALIZADORA (tem COD_OPERADOR)
      let nomeOperador = '';
      try {
        const sqlOp = `
          SELECT op.DES_OPERADOR FROM ${schema}.TAB_CUPOM_FINALIZADORA cf
          JOIN ${schema}.TAB_OPERADORES op ON op.COD_OPERADOR = cf.COD_OPERADOR
          WHERE cf.NUM_CUPOM_FISCAL = :cupomNum AND cf.NUM_PDV = :pdv
            AND TRUNC(cf.DTA_VENDA) = TO_DATE(:dateStr, 'DD/MM/YYYY')
            AND cf.COD_OPERADOR IS NOT NULL AND ROWNUM = 1`;
        const opRows: any[] = await OracleService.query(sqlOp, { cupomNum, pdv, dateStr });
        if (opRows && opRows.length > 0) {
          nomeOperador = (opRows[0].DES_OPERADOR || '').trim();
        }
      } catch (e: any) {
        console.log('[DVR] Operador não encontrado:', e.message);
      }
      const cancelado = cupomRows[0]?.FLG_CUPOM_CANCELADO === 'S';

      // Buscar forma de pagamento (finalizadoras dinâmicas do Oracle)
      const finalizadoraMap = await this.getFinalizadoraMap();
      let formaPgto = '';
      let valorRecebido = 0;
      let valorTroco = 0;
      try {
        const sqlFin = `
          SELECT COD_FINALIZADORA, VAL_RECEBIDO, VAL_TROCO
          FROM ${schema}.TAB_CUPOM_FINALIZADORA
          WHERE DTA_VENDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
            AND NUM_PDV = :pdv
            AND NUM_CUPOM_FISCAL = :cupomNum
        `;
        const finRows: any[] = await OracleService.query(sqlFin, { dateStr, pdv, cupomNum });
        if (finRows && finRows.length > 0) {
          const formas = finRows.map((f: any) => {
            const nome = finalizadoraMap[f.COD_FINALIZADORA] || `COD ${f.COD_FINALIZADORA}`;
            return `${nome} (R$ ${(Number(f.VAL_RECEBIDO) || 0).toFixed(2)})`;
          });
          formaPgto = formas.join(', ');
          valorRecebido = finRows.reduce((s: number, f: any) => s + (Number(f.VAL_RECEBIDO) || 0), 0);
          valorTroco = finRows.reduce((s: number, f: any) => s + (Number(f.VAL_TROCO) || 0), 0);
        }
      } catch (e: any) {
        console.log('[DVR] Finalizadora não disponível:', e.message);
      }

      // Buscar descontos do cupom
      const totalDesconto = cupomRows.reduce((s: number, r: any) => s + (Number(r.VAL_DESCONTO) || 0), 0);

      return {
        cupom: cupomNum,
        itens,
        total: Math.round(totalCupom * 100) / 100,
        qtdItens: itens.length,
        operador: nomeOperador || '',
        formaPgto,
        cancelado,
        hora: cupomRows[0]?.HORA || '',
        desconto: Math.round(totalDesconto * 100) / 100,
        valorRecebido: Math.round(valorRecebido * 100) / 100,
        troco: Math.round(valorTroco * 100) / 100,
      };
    } catch (error: any) {
      console.error('[DVR] ERRO CUPOM ORACLE:', error.message);
      // Retornar erro ao invés de null silencioso
      throw error;
    }
  }

  /**
   * Consultar Oracle para descobrir duração real do cupom (primeiro ao último item)
   */
  static async getCupomTimeRange(time: string, channel: number): Promise<{ start: string; end: string; durationSec: number } | null> {
    try {
      const config = await this.getConfig();
      const pdv = this.channelToPdv(config, channel);
      const [datePart, timePart] = time.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const dateStr = `${day}/${month}/${year}`;
      const minBefore = parseInt(minute) > 0 ? parseInt(minute) - 1 : 0;
      const minAfter = parseInt(minute) < 59 ? parseInt(minute) + 1 : 59;

      const schema = await MappingService.getSchema();
      const sql = `
        SELECT NUM_CUPOM_FISCAL,
               TO_CHAR(MIN(TIM_HORA), 'HH24:MI:SS') HORA_INICIO,
               TO_CHAR(MAX(TIM_HORA), 'HH24:MI:SS') HORA_FIM,
               (CAST(MAX(TIM_HORA) AS DATE) - CAST(MIN(TIM_HORA) AS DATE)) * 86400 DURACAO_SEG
        FROM ${schema}.TAB_PRODUTO_PDV
        WHERE DTA_SAIDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
          AND NUM_PDV = :pdv
          AND TO_CHAR(TIM_HORA, 'HH24') = :hour
          AND TO_NUMBER(TO_CHAR(TIM_HORA, 'MI')) BETWEEN :minBefore AND :minAfter
          AND NUM_CUPOM_FISCAL > 0
        GROUP BY NUM_CUPOM_FISCAL
        ORDER BY NUM_CUPOM_FISCAL
        FETCH FIRST 1 ROWS ONLY
      `;

      const rows: any[] = await OracleService.query(sql, {
        dateStr, pdv, hour: hour.padStart(2, '0'), minBefore, minAfter
      });

      if (rows && rows.length > 0) {
        const row = rows[0];
        const duracaoSeg = Math.max(Number(row.DURACAO_SEG) || 0, 30); // mínimo 30s
        console.log(`[DVR] Cupom ${row.NUM_CUPOM_FISCAL}: início=${row.HORA_INICIO}, fim=${row.HORA_FIM}, duração=${duracaoSeg}s`);
        return {
          start: `${datePart} ${row.HORA_INICIO}`,
          end: `${datePart} ${row.HORA_FIM}`,
          durationSec: duracaoSeg
        };
      }
    } catch (e: any) {
      console.log('[DVR] Não conseguiu buscar range do cupom:', e.message);
    }
    return null;
  }

  /**
   * Gerar clipe MP4 via RTSP/ffmpeg
   */
  static async generateClip(channel: number, time: string, duration?: number): Promise<string> {
    const config = await this.getConfig();

    // Criar diretório para clipes
    const clipsDir = path.join(__dirname, '../../uploads/dvr-clips');
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    // Usar o horário do DVR diretamente (relógio do DVR = relógio do RTSP)
    // Começar a partir do Time do evento DVR e gravar 90s
    const transactionDate = new Date(time.replace(' ', 'T'));
    const clipDuration = duration || 90;
    const start = transactionDate;
    const end = new Date(transactionDate.getTime() + clipDuration * 1000);

    const formatRTSP = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
    };

    // Canal DVR = channel + 1 (API usa 0-based, RTSP usa 1-based)
    const dvrChannel = this.channelToRtsp(channel);
    const passEncoded = encodeURIComponent(config.pass);
    const rtspUrl = `rtsp://${config.user}:${passEncoded}@${config.ip}:${config.rtspPort}/cam/playback?channel=${dvrChannel}&starttime=${formatRTSP(start)}&endtime=${formatRTSP(end)}`;

    // Nome único para o arquivo
    const filename = `clip_ch${dvrChannel}_${Date.now()}.mp4`;
    const outputPath = path.join(clipsDir, filename);

    console.log(`[DVR] Generating clip: channel=${dvrChannel}, start=${formatRTSP(start)}, end=${formatRTSP(end)}, duration=${clipDuration}s`);

    // ffmpeg: converter RTSP para MP4
    const ffmpegArgs = [
      '-y', '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-t', String(clipDuration),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-vf', 'scale=704:480',
      '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '64k',
      outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', ffmpegArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrData = '';
      proc.stderr.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        console.log(`[DVR] ffmpeg stderr (timeout):\n${stderrData.slice(-500)}`);
        reject(new Error('ffmpeg timeout'));
      }, 180000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`[DVR] ffmpeg exit code: ${code}`);
        console.log(`[DVR] ffmpeg stderr (last 500 chars):\n${stderrData.slice(-500)}`);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
          console.log(`[DVR] Clip generated: ${filename} (${sizeMB}MB)`);
          resolve();
        } else if (code !== 0) {
          reject(new Error(`ffmpeg exit code ${code}`));
        } else {
          resolve();
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return filename;
  }

  /**
   * Streaming RTSP → fragmented MP4 direto (sem salvar arquivo)
   * Retorna o ChildProcess do ffmpeg para pipe no response HTTP
   */
  static async startRTSPStream(channel: number, time: string, antesOverride?: number, depoisOverride?: number): Promise<import('child_process').ChildProcess> {
    const config = await this.getConfig();

    const transactionDate = new Date(time.replace(' ', 'T'));
    // Per-camera override (Bipagens) ou config global (Vision PDV)
    const antesSegundos = antesOverride ?? config.antecedenciaSegundos;
    const depoisSegundos = depoisOverride ?? config.tempoDepoisSegundos;
    const start = new Date(transactionDate.getTime() - antesSegundos * 1000);
    const end = new Date(transactionDate.getTime() + depoisSegundos * 1000);

    const formatRTSP = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
    };

    const dvrChannel = this.channelToRtsp(channel);
    const passEncoded = encodeURIComponent(config.pass);
    const rtspUrl = `rtsp://${config.user}:${passEncoded}@${config.ip}:${config.rtspPort}/cam/playback?channel=${dvrChannel}&starttime=${formatRTSP(start)}&endtime=${formatRTSP(end)}`;

    console.log(`[DVR] Stream: channel=${dvrChannel}, start=${formatRTSP(start)}, end=${formatRTSP(end)}`);

    // ffmpeg: RTSP → fragmented MP4 no stdout (streaming progressivo)
    // Usa copy codec para início quase instantâneo (sem re-encoding)
    const totalDuration = antesSegundos + depoisSegundos;
    console.log(`[DVR] Stream duration: ${totalDuration}s (antes=${antesSegundos}, depois=${depoisSegundos})`);
    const proc = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-fflags', '+genpts+nobuffer+discardcorrupt',
      '-flags', 'low_delay',
      '-analyzeduration', '500000',
      '-probesize', '500000',
      '-i', rtspUrl,
      '-t', String(totalDuration),
      '-c:v', 'copy',
      '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-c:a', 'aac', '-b:a', '64k',
      '-f', 'mp4',
      'pipe:1'
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stderr.on('data', (data: Buffer) => {
      // Log apenas erros reais, ignorar progresso
      const msg = data.toString();
      if (msg.includes('error') || msg.includes('Error')) {
        console.error(`[DVR] ffmpeg stream error: ${msg.slice(0, 200)}`);
      }
    });

    return proc;
  }

  /**
   * Obter caminho completo do clipe
   */
  static getClipPath(filename: string): string {
    return path.join(__dirname, '../../uploads/dvr-clips', filename);
  }

  /**
   * Retorna canais configurados e canal padrão
   */
  static async getCanaisConfig(): Promise<{ canais: { channel: number; pdv: number; label: string }[]; canalPadrao: number }> {
    const config = await this.getConfig();
    return { canais: config.canais, canalPadrao: config.canalPadrao };
  }

  /**
   * Testa conexão RPC2 com o DVR
   */
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getConfig();
      if (!config.ip) {
        return { success: false, message: 'IP do DVR não configurado' };
      }
      // Invalidar sessão para forçar novo login
      this.session = null;
      const sessionId = await this.login();
      return { success: true, message: `Conectado com sucesso (sessão: ${sessionId.substring(0, 8)}...)` };
    } catch (e: any) {
      return { success: false, message: e.message || 'Falha na conexão' };
    }
  }

  /**
   * Detectar canais do DVR via RPC2
   * Consulta configManager.getConfig para obter títulos dos canais e quantidade de entradas de vídeo
   */
  static async detectChannels(): Promise<{ canais: { channel: number; pdv: number; label: string }[] }> {
    const config = await this.getConfig();
    if (!config.ip) {
      throw new Error('IP do DVR não configurado');
    }

    const sessionId = await this.login();

    // Buscar títulos dos canais
    let titles: string[] = [];
    try {
      const titleResult = await this.rpcCall(config.ip, '/RPC2', sessionId, 'configManager.getConfig', {
        name: 'ChannelTitle'
      }, 20, config.httpPort);
      if (titleResult.params?.table) {
        titles = titleResult.params.table.map((t: any) => t.Name || '');
      }
    } catch (e: any) {
      console.log('[DVR] Não conseguiu buscar ChannelTitle:', e.message);
    }

    // Buscar quantidade de canais de vídeo
    let videoInputCount = 0;
    try {
      const capsResult = await this.rpcCall(config.ip, '/RPC2', sessionId, 'magicBox.getDeviceType', {}, 21, config.httpPort);
      console.log('[DVR] DeviceType:', JSON.stringify(capsResult));
    } catch { /* ignore */ }

    try {
      const sysInfo = await this.rpcCall(config.ip, '/RPC2', sessionId, 'magicBox.getProductDefinition', {}, 22, config.httpPort);
      if (sysInfo.params?.VideoInChannel) {
        videoInputCount = sysInfo.params.VideoInChannel;
      }
      console.log('[DVR] VideoInChannel:', videoInputCount);
    } catch (e: any) {
      console.log('[DVR] Não conseguiu buscar ProductDefinition:', e.message);
    }

    // Se não conseguiu pelo ProductDefinition, usar os títulos
    const count = videoInputCount || titles.length || 16;
    const canais: { channel: number; pdv: number; label: string }[] = [];

    for (let i = 0; i < count; i++) {
      const title = titles[i] || '';
      const label = title ? `Canal ${i + 1} - ${title}` : `Canal ${i + 1} - PDV ${i + 1}`;
      canais.push({
        channel: i,
        pdv: i + 1,
        label
      });
    }

    console.log(`[DVR] Detectados ${canais.length} canais`);
    return { canais };
  }

  /**
   * Limpar clipes antigos (> 1 hora)
   */
  static async cleanOldClips(): Promise<number> {
    const clipsDir = path.join(__dirname, '../../uploads/dvr-clips');
    if (!fs.existsSync(clipsDir)) return 0;

    const files = fs.readdirSync(clipsDir);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let removed = 0;

    for (const file of files) {
      const filePath = path.join(clipsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath);
        removed++;
      }
    }
    return removed;
  }
}
