import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import { OracleService } from './oracle.service';

const execPromise = promisify(exec);

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
        { key: 'dvr_senha' }
      ]
    });
    const map: Record<string, string> = {};
    configs.forEach(c => { map[c.key] = c.value || ''; });
    return {
      ip: map.dvr_ip || '10.6.1.123',
      user: map.dvr_usuario || 'admin',
      pass: map.dvr_senha || ''
    };
  }

  /**
   * RPC2 HTTP call
   */
  private static rpcCall(ip: string, urlPath: string, sessionId: string | null, method: string, params: any, id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ method, params, id, session: sessionId || undefined });
      const req = http.request({
        hostname: ip,
        port: 80,
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
    }, 1);

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
    }, 2);

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
    }, 10);

    if (!findResult.result) {
      throw new Error('POS.startFind failed');
    }

    const token = findResult.params.token;
    const totalCount = findResult.params.totalCount || 0;

    // doFind - DVR retorna no máximo 100 resultados (paginação não funciona)
    const results = await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.doFind', {
      token, count: 100, offset: 0
    }, 11);

    // stopFind
    await this.rpcCall(config.ip, '/RPC2', sessionId, 'POS.stopFind', { token }, 12);

    const items: POSSearchResult[] = results.params?.info || [];

    // Enriquecer com número do cupom do Oracle e filtrar por texto
    try {
      const pdv = channel + 1;
      const enriched = await this.enrichWithCupomNumbers(items, pdv);

      // Se tem texto de busca, filtrar via Oracle (DVR não filtra por texto)
      if (text && text.trim()) {
        const oracleResults = await this.searchByOracleText(pdv, startTime, endTime, text.trim(), channel);
        // Enriquecer resultados Oracle com cupom do DVR quando disponível
        const dvrTimeMap: Record<string, POSSearchResult> = {};
        for (const item of enriched) {
          if (item.Time) {
            const hm = item.Time.split(' ')[1]?.substring(0, 5);
            if (hm && !dvrTimeMap[hm]) dvrTimeMap[hm] = item;
          }
        }
        // Marcar quais resultados Oracle têm vídeo DVR correspondente
        for (const item of oracleResults) {
          const hm = item.Time?.split(' ')[1]?.substring(0, 5);
          if (hm && dvrTimeMap[hm]) {
            item.ID = dvrTimeMap[hm].ID; // usar ID do DVR para gerar vídeo
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

    // Palavras-chave especiais
    const KEYWORDS: Record<string, string> = {
      'CANCELAMENTO': 'cancelado',
      'CANCELADO': 'cancelado',
      'CANCEL': 'cancelado',
      'DESCONTO': 'desconto',
      'DINHEIRO': 'fin_1',
      'PIX': 'fin_15',
      'CREDITO': 'fin_6',
      'CARTAO CREDITO': 'fin_6',
      'DEBITO': 'fin_7',
      'CARTAO DEBITO': 'fin_7',
      'FUNCIONARIO': 'fin_4',
      'VALE TROCA': 'fin_8',
      'VALE COMPRA': 'fin_9',
    };

    const keyword = KEYWORDS[textUpper];
    let whereExtra = '';
    let params: any = { dateStr, pdv };

    if (keyword === 'cancelado') {
      whereExtra = `AND p.FLG_CUPOM_CANCELADO = 'S'`;
    } else if (keyword === 'desconto') {
      whereExtra = `AND p.VAL_DESCONTO > 0`;
    } else if (keyword?.startsWith('fin_')) {
      const codFin = parseInt(keyword.split('_')[1]);
      whereExtra = `AND EXISTS (
        SELECT 1 FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
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
      FROM INTERSOLID.TAB_PRODUTO_PDV p
      LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
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
    const sql = `
      SELECT DISTINCT NUM_CUPOM_FISCAL, TO_CHAR(TIM_HORA, 'HH24:MI:SS') HORA
      FROM INTERSOLID.TAB_PRODUTO_PDV
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
  static async getCupomByTime(time: string, pdv: number): Promise<any> {
    try {
      // time = "2026-03-04 17:24:12"
      const [datePart, timePart] = time.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const dateStr = `${day}/${month}/${year}`;

      // Buscar cupons no Oracle com +/- 1 minuto de tolerância
      const minBefore = parseInt(minute) > 0 ? parseInt(minute) - 1 : 0;
      const minAfter = parseInt(minute) < 59 ? parseInt(minute) + 1 : 59;
      const hourPad = hour.padStart(2, '0');

      const sql = `
        SELECT p.NUM_CUPOM_FISCAL, TO_CHAR(p.TIM_HORA, 'HH24:MI:SS') HORA,
               p.COD_PRODUTO, pr.DES_PRODUTO, p.QTD_TOTAL_PRODUTO QTD,
               p.VAL_PRECO_VENDA UNITARIO, p.VAL_TOTAL_PRODUTO TOTAL,
               p.VAL_DESCONTO, p.FLG_CUPOM_CANCELADO,
               p.COD_ENTIDADE, p.NUM_SEQ_ITEM
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON p.COD_PRODUTO = pr.COD_PRODUTO
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
          const sqlOp = `SELECT NOM_OPERADOR FROM INTERSOLID.TAB_OPERADORES WHERE COD_OPERADOR = :cod`;
          const opRows: any[] = await OracleService.query(sqlOp, { cod: codOperador });
          if (opRows && opRows.length > 0) {
            nomeOperador = (opRows[0].NOM_OPERADOR || '').trim();
          }
        } catch (e: any) {
          console.log('[DVR] Operador não encontrado:', e.message);
        }
      }
      const cancelado = cupomRows[0]?.FLG_CUPOM_CANCELADO === 'S';

      // Buscar forma de pagamento (finalizadoras)
      const FINALIZADORA_MAP: Record<number, string> = {
        1: 'DINHEIRO', 4: 'FUNCIONÁRIO', 5: 'CARTÃO POS',
        6: 'CARTÃO CRÉDITO', 7: 'CARTÃO DÉBITO', 15: 'PIX',
        8: 'VALE TROCA', 9: 'VALE COMPRA', 10: 'CONVÊNIO',
      };
      let formaPgto = '';
      let valorRecebido = 0;
      let valorTroco = 0;
      try {
        const sqlFin = `
          SELECT COD_FINALIZADORA, VAL_RECEBIDO, VAL_TROCO
          FROM INTERSOLID.TAB_CUPOM_FINALIZADORA
          WHERE DTA_VENDA = TO_DATE(:dateStr, 'DD/MM/YYYY')
            AND NUM_PDV = :pdv
            AND NUM_CUPOM_FISCAL = :cupomNum
        `;
        const finRows: any[] = await OracleService.query(sqlFin, { dateStr, pdv, cupomNum });
        if (finRows && finRows.length > 0) {
          const formas = finRows.map((f: any) => {
            const nome = FINALIZADORA_MAP[f.COD_FINALIZADORA] || `COD ${f.COD_FINALIZADORA}`;
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
   * Gerar clipe MP4 via RTSP/ffmpeg
   */
  static async generateClip(channel: number, time: string, duration: number = 30): Promise<string> {
    const config = await this.getConfig();

    // Criar diretório para clipes
    const clipsDir = path.join(__dirname, '../../uploads/dvr-clips');
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    // Calcular startTime (15 seg antes) e endTime (15 seg depois)
    const transactionDate = new Date(time.replace(' ', 'T'));
    const halfDuration = Math.floor(duration / 2);
    const start = new Date(transactionDate.getTime() - halfDuration * 1000);
    const end = new Date(transactionDate.getTime() + halfDuration * 1000);

    const formatRTSP = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
    };

    // Canal DVR = channel + 1 (API usa 0-based, RTSP usa 1-based)
    const dvrChannel = channel + 1;
    const passEncoded = encodeURIComponent(config.pass);
    const rtspUrl = `rtsp://${config.user}:${passEncoded}@${config.ip}:554/cam/playback?channel=${dvrChannel}&starttime=${formatRTSP(start)}&endtime=${formatRTSP(end)}`;

    // Nome único para o arquivo
    const filename = `clip_ch${dvrChannel}_${Date.now()}.mp4`;
    const outputPath = path.join(clipsDir, filename);

    // ffmpeg: converter RTSP para MP4 (resolução reduzida para streaming rápido)
    const cmd = `ffmpeg -y -rtsp_transport tcp -i "${rtspUrl}" -t ${duration} -c:v libx264 -preset ultrafast -crf 28 -vf scale=704:480 -movflags +faststart -an "${outputPath}"`;

    try {
      await execPromise(cmd, { timeout: 90000 });
    } catch (error: any) {
      // ffmpeg pode retornar exit code != 0 mas gerar arquivo válido
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        throw new Error('Falha ao gerar clipe de vídeo: ' + error.message);
      }
    }

    return filename;
  }

  /**
   * Obter caminho completo do clipe
   */
  static getClipPath(filename: string): string {
    return path.join(__dirname, '../../uploads/dvr-clips', filename);
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
