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
        { key: 'dvr_antecedencia_segundos' }
      ]
    });
    const map: Record<string, string> = {};
    configs.forEach(c => { map[c.key] = c.value || ''; });

    // Parse canais JSON
    let canais: { channel: number; pdv: number; label: string }[] = [];
    try {
      if (map.dvr_canais) canais = JSON.parse(map.dvr_canais);
    } catch { /* ignore */ }

    return {
      ip: map.dvr_ip || '',
      user: map.dvr_usuario || 'admin',
      pass: map.dvr_senha || '',
      httpPort: parseInt(map.dvr_porta_http || '80'),
      rtspPort: map.dvr_porta_rtsp || '554',
      canais,
      canalPadrao: parseInt(map.dvr_canal_padrao || '0'),
      antecedenciaSegundos: parseInt(map.dvr_antecedencia_segundos || '15')
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
   * Mapa padrão de finalizadoras (fallback quando Oracle não tem TAB_FINALIZADORA)
   */
  private static readonly DEFAULT_FINALIZADORA_MAP: Record<number, string> = {
    1: 'DINHEIRO',
    2: 'CHEQUE',
    3: 'CARTAO CREDITO',
    4: 'CARTAO DEBITO',
    5: 'CREDIARIO',
    6: 'VALE COMPRA',
    7: 'CONVENIO',
    8: 'PIX',
    9: 'TICKET',
    10: 'BOLETO',
    11: 'TRANSFERENCIA',
    12: 'DEPOSITO',
  };

  /**
   * Keywords comuns e seus sinônimos para busca de finalizadoras
   */
  private static readonly KEYWORD_SYNONYMS: Record<string, string[]> = {
    'DINHEIRO': ['DINHEIRO', 'ESPECIE', 'CASH'],
    'CHEQUE': ['CHEQUE'],
    'CARTAO CREDITO': ['CARTAO CREDITO', 'CREDITO', 'CREDIT'],
    'CARTAO DEBITO': ['CARTAO DEBITO', 'DEBITO', 'DEBIT'],
    'CREDIARIO': ['CREDIARIO', 'FIADO'],
    'VALE COMPRA': ['VALE COMPRA', 'VALE', 'VOUCHER'],
    'CONVENIO': ['CONVENIO', 'CONVENIADO'],
    'PIX': ['PIX'],
    'TICKET': ['TICKET', 'VALE REFEICAO', 'VALE ALIMENTACAO', 'VR', 'VA'],
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
      // Tentar TAB_FINALIZADORA primeiro (tem descrição)
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
          console.log(`[DVR] Finalizadoras carregadas do Oracle (TAB_FINALIZADORA): ${Object.keys(map).length} itens`);
          return map;
        }
      } catch {
        // TAB_FINALIZADORA não existe, tentar pegar códigos distintos de TAB_CUPOM_FINALIZADORA
        console.log('[DVR] TAB_FINALIZADORA não existe, usando códigos de TAB_CUPOM_FINALIZADORA + mapa padrão');
      }

      // Fallback: buscar códigos distintos de TAB_CUPOM_FINALIZADORA e mapear com nomes padrão
      try {
        const sql2 = `SELECT DISTINCT COD_FINALIZADORA FROM ${schema}.TAB_CUPOM_FINALIZADORA ORDER BY COD_FINALIZADORA`;
        const rows2: any[] = await OracleService.query(sql2, {});
        if (rows2 && rows2.length > 0) {
          const map: Record<number, string> = {};
          for (const row of rows2) {
            const cod = row.COD_FINALIZADORA;
            map[cod] = this.DEFAULT_FINALIZADORA_MAP[cod] || `FINALIZADORA ${cod}`;
          }
          this.finalizadoraCache = map;
          this.finalizadoraCacheTime = Date.now();
          console.log(`[DVR] Finalizadoras mapeadas via TAB_CUPOM_FINALIZADORA + padrão: ${Object.keys(map).length} itens`, map);
          return map;
        }
      } catch (e2: any) {
        console.log('[DVR] TAB_CUPOM_FINALIZADORA DISTINCT também falhou:', e2.message);
      }

      // Último fallback: mapa padrão hardcoded
      console.log('[DVR] Usando mapa padrão de finalizadoras (fallback)');
      this.finalizadoraCache = { ...this.DEFAULT_FINALIZADORA_MAP };
      this.finalizadoraCacheTime = Date.now();
      return this.finalizadoraCache;
    } catch (e: any) {
      console.error('[DVR] Erro ao carregar finalizadoras:', e.message);
      // Retorna mapa padrão como último recurso
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
   * Buscar transações POS por texto
   */
  static async searchPOS(channel: number, startTime: string, endTime: string, text: string): Promise<{ total: number; items: POSSearchResult[] }> {
    const config = await this.getConfig();
    const sessionId = await this.login();

    // startFind
    const findResult = await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.startFind', {
      channel,
      condition: { StartTime: startTime, EndTime: endTime, Text: text }
    }, 10, config.httpPort);

    if (!findResult.result) {
      throw new Error('POS.startFind failed');
    }

    const token = findResult.params.token;
    const totalCount = findResult.params.totalCount || 0;

    // doFind - DVR retorna no máximo 100 resultados (paginação não funciona)
    const results = await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.doFind', {
      token, count: 100, offset: 0
    }, 11, config.httpPort);

    // stopFind
    await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.stopFind', { token }, 12, config.httpPort);

    const items: POSSearchResult[] = results.params?.info || [];

    // Debug: ver formato exato do Time retornado pelo DVR
    if (items.length > 0) {
      console.log(`[DVR] Primeiro item raw:`, JSON.stringify(items[0]));
      console.log(`[DVR] Primeiros 3 Times:`, items.slice(0, 3).map(i => i.Time));
    }

    // Enriquecer com número do cupom do Oracle e filtrar por texto
    try {
      const pdv = this.channelToPdv(config, channel);
      const enriched = await this.enrichWithCupomNumbers(items, pdv);

      // Se tem texto de busca, filtrar via Oracle (DVR não filtra por texto)
      if (text && text.trim()) {
        const oracleResults = await this.searchByOracleText(pdv, startTime, endTime, text.trim(), channel);
        // Enriquecer resultados Oracle com dados do DVR (ID + Time exato com segundos)
        const dvrTimeMap: Record<string, POSSearchResult> = {};
        for (const item of enriched) {
          if (item.Time) {
            const hm = item.Time.split(' ')[1]?.substring(0, 5);
            if (hm && !dvrTimeMap[hm]) dvrTimeMap[hm] = item;
          }
        }
        for (const item of oracleResults) {
          const hm = item.Time?.split(' ')[1]?.substring(0, 5);
          if (hm && dvrTimeMap[hm]) {
            item.ID = dvrTimeMap[hm].ID; // usar ID do DVR para gerar vídeo
            item.Time = dvrTimeMap[hm].Time; // usar Time do DVR (com segundos exatos)
          }
        }
        return { total: oracleResults.length, items: oracleResults };
      }

      return { total: totalCount, items: enriched };
    } catch (err: any) {
      console.error('[DVR] Erro ao enriquecer com cupom:', err.message);
      return { total: totalCount, items };
    }
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
   * Buscar itens do cupom no Oracle pelo timestamp da transação DVR
   */
  static async getCupomByTime(time: string, channel: number): Promise<any> {
    try {
      const config = await this.getConfig();
      const pdv = this.channelToPdv(config, channel);
      // time = "2026-03-04 17:24:12"
      const [datePart, timePart] = time.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const dateStr = `${day}/${month}/${year}`;

      // Buscar cupons no Oracle com +/- 1 minuto de tolerância
      const minBefore = parseInt(minute) > 0 ? parseInt(minute) - 1 : 0;
      const minAfter = parseInt(minute) < 59 ? parseInt(minute) + 1 : 59;
      const hourPad = hour.padStart(2, '0');

      const schema = await MappingService.getSchema();
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

      const rows: any[] = await OracleService.query(sql, {
        dateStr, pdv, hour: hourPad,
        minBefore, minAfter
      });

      console.log(`[DVR] getCupomByTime: ${rows?.length || 0} rows encontrados`);

      if (!rows || rows.length === 0) return null;

      // Pegar o cupom mais próximo do horário
      const targetMin = parseInt(minute);
      const targetSec = parseInt(timePart.split(':')[2] || '0');

      // Agrupar por cupom
      const cupons: Record<number, any[]> = {};
      for (const row of rows) {
        const num = row.NUM_CUPOM_FISCAL;
        if (!cupons[num]) cupons[num] = [];
        cupons[num].push(row);
      }

      // Pegar o primeiro cupom (mais próximo)
      const cupomNum = Object.keys(cupons).map(Number)[0];
      const cupomRows = cupons[cupomNum];

      const itens: POSItem[] = cupomRows.map((r: any) => ({
        cod: r.COD_PRODUTO,
        descricao: (r.DES_PRODUTO || 'PRODUTO').trim(),
        qtd: Number(r.QTD) || 0,
        unitario: Number(r.UNITARIO) || 0,
        total: Number(r.TOTAL) || 0,
      }));

      const totalCupom = itens.reduce((s, i) => s + i.total, 0);
      const codOperador = cupomRows[0]?.COD_ENTIDADE || '';

      // Buscar nome do operador
      let nomeOperador = '';
      if (codOperador) {
        try {
          const sqlOp = `SELECT NOM_OPERADOR FROM ${schema}.TAB_OPERADORES WHERE COD_OPERADOR = :cod`;
          const opRows: any[] = await OracleService.query(sqlOp, { cod: codOperador });
          if (opRows && opRows.length > 0) {
            nomeOperador = (opRows[0].NOM_OPERADOR || '').trim();
          }
        } catch (e: any) {
          console.log('[DVR] Operador não encontrado:', e.message);
        }
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
        operador: nomeOperador || (codOperador ? `Cód. ${codOperador}` : ''),
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
      '-an', outputPath
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
  static async startRTSPStream(channel: number, time: string): Promise<import('child_process').ChildProcess> {
    const config = await this.getConfig();

    const transactionDate = new Date(time.replace(' ', 'T'));
    // Começar N segundos antes do evento POS (configurável por cliente)
    const start = new Date(transactionDate.getTime() - config.antecedenciaSegundos * 1000);
    // Janela larga: 5 minutos (o usuário controla no player)
    const end = new Date(start.getTime() + 5 * 60 * 1000);

    const formatRTSP = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
    };

    const dvrChannel = this.channelToRtsp(channel);
    const passEncoded = encodeURIComponent(config.pass);
    const rtspUrl = `rtsp://${config.user}:${passEncoded}@${config.ip}:${config.rtspPort}/cam/playback?channel=${dvrChannel}&starttime=${formatRTSP(start)}&endtime=${formatRTSP(end)}`;

    console.log(`[DVR] Stream: channel=${dvrChannel}, start=${formatRTSP(start)}, end=${formatRTSP(end)}`);

    // ffmpeg: RTSP → fragmented MP4 no stdout (streaming progressivo)
    const proc = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
      '-crf', '28', '-vf', 'scale=704:480',
      '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-f', 'mp4',
      '-an',
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
