import { Request, Response } from 'express';
import * as fs from 'fs';
import { DVRCFTVService } from '../services/dvr-cftv.service';

export class DVRCFTVController {

  /**
   * Buscar transações POS por texto
   * GET /api/dvr-cftv/pos/search?text=suco&channel=3&start=2026-03-04 00:00:00&end=2026-03-04 23:59:59
   */
  static async searchPOS(req: Request, res: Response) {
    try {
      const { text, channel, start, end } = req.query;

      const canalConfig = await DVRCFTVService.getCanaisConfig();
      const ch = channel !== undefined ? parseInt(channel as string) : canalConfig.canalPadrao;
      const startTime = (start as string) || new Date().toISOString().slice(0, 10) + ' 00:00:00';
      const endTime = (end as string) || new Date().toISOString().slice(0, 10) + ' 23:59:59';

      const result = await DVRCFTVService.searchPOS(ch, startTime, endTime, (text as string) || '');

      res.json({
        success: true,
        total: result.total,
        items: result.items
      });
    } catch (error: any) {
      console.error('Erro ao buscar POS:', error.message);
      res.status(500).json({ error: 'Erro ao buscar transações POS', details: error.message });
    }
  }

  /**
   * Gerar clipe MP4 (aguarda ffmpeg) e retorna filename
   * GET /api/dvr-cftv/pos/generate-clip?channel=3&time=2026-03-04 17:55:00&duration=15
   */
  static async generateClip(req: Request, res: Response) {
    try {
      const { channel, time, duration } = req.query;

      if (!time) {
        return res.status(400).json({ error: 'Parâmetro "time" é obrigatório' });
      }

      const canalConfig2 = await DVRCFTVService.getCanaisConfig();
      const ch = channel !== undefined ? parseInt(channel as string) : canalConfig2.canalPadrao;
      const dur = parseInt(duration as string) || 60;

      // Limpar clipes antigos
      DVRCFTVService.cleanOldClips().catch(() => {});

      console.log(`[DVR] Gerando clip: canal=${ch}, time=${time}, duration=${dur}s`);
      const filename = await DVRCFTVService.generateClip(ch, time as string, dur);
      const filePath = DVRCFTVService.getClipPath(filename);
      const stat = fs.statSync(filePath);
      console.log(`[DVR] Clip gerado: ${filename} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);

      res.json({ success: true, filename, size: stat.size });
    } catch (error: any) {
      console.error('Erro ao gerar clipe:', error.message);
      res.status(500).json({ error: 'Erro ao gerar clipe de vídeo', details: error.message });
    }
  }

  /**
   * Buscar cupom/nota do Oracle pelo timestamp da transação DVR
   * GET /api/dvr-cftv/pos/cupom?time=2026-03-04 17:24:12&channel=3
   */
  static async getCupom(req: Request, res: Response) {
    try {
      const { time, channel, cupomNum, pdv } = req.query;
      if (!time) {
        return res.status(400).json({ error: 'Parâmetro "time" é obrigatório' });
      }

      const canalConfig3 = await DVRCFTVService.getCanaisConfig();
      const ch = channel !== undefined ? parseInt(channel as string) : canalConfig3.canalPadrao;
      const cupomNumParsed = cupomNum ? parseInt(cupomNum as string) : undefined;
      const pdvParsed = pdv !== undefined && pdv !== '' ? parseInt(pdv as string) : undefined;

      console.log(`[DVR] getCupom: time="${time}", channel=${ch}, cupomNum=${cupomNumParsed || 'auto'}, pdv=${pdvParsed ?? 'auto'}`);
      const cupom = await DVRCFTVService.getCupomByTime(time as string, ch, cupomNumParsed, pdvParsed);

      if (!cupom) {
        return res.json({ success: true, found: false, message: 'Nenhum cupom encontrado neste horário' });
      }

      res.json({ success: true, found: true, ...cupom });
    } catch (error: any) {
      console.error('Erro ao buscar cupom:', error.message);
      res.status(500).json({ error: 'Erro ao buscar cupom', details: error.message });
    }
  }

  /**
   * Servir clipe MP4 já gerado (com suporte a Range requests)
   * GET /api/dvr-cftv/pos/stream/:filename
   */
  static async streamClip(req: Request, res: Response) {
    try {
      const { filename } = req.params;

      // Sanitizar filename para evitar path traversal
      const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
      const filePath = DVRCFTVService.getClipPath(safeName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Clipe não encontrado' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        });

        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error: any) {
      console.error('Erro ao servir clipe:', error.message);
      res.status(500).json({ error: 'Erro ao servir clipe', details: error.message });
    }
  }

  /**
   * Streaming RTSP direto do DVR → fragmented MP4
   * GET /api/dvr-cftv/pos/live-stream?channel=3&time=2026-03-05 08:15:00
   */
  static async liveStream(req: Request, res: Response) {
    try {
      const { channel, time, antes, depois } = req.query;

      if (!time) {
        return res.status(400).json({ error: 'Parâmetro "time" é obrigatório' });
      }

      const canalConfig4 = await DVRCFTVService.getCanaisConfig();
      const ch = channel !== undefined ? parseInt(channel as string) : canalConfig4.canalPadrao;

      // Per-camera override de antes/depois (usado por Bipagens)
      const antesOverride = antes ? parseInt(antes as string) : undefined;
      const depoisOverride = depois ? parseInt(depois as string) : undefined;

      console.log(`[DVR] Live stream: canal=${ch}, time=${time}, antes=${antesOverride ?? 'default'}, depois=${depoisOverride ?? 'default'}`);

      const ffmpegProc = await DVRCFTVService.startRTSPStream(ch, time as string, antesOverride, depoisOverride);

      if (!ffmpegProc.stdout) {
        return res.status(500).json({ error: 'Falha ao iniciar stream' });
      }

      // Headers para streaming MP4
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Connection', 'keep-alive');

      // Pipe ffmpeg stdout → HTTP response
      ffmpegProc.stdout.pipe(res);

      // Quando o cliente desconectar, matar o ffmpeg
      res.on('close', () => {
        console.log('[DVR] Client disconnected, killing ffmpeg stream');
        ffmpegProc.kill('SIGKILL');
      });

      // Quando ffmpeg terminar, finalizar response
      ffmpegProc.on('close', (code) => {
        console.log(`[DVR] ffmpeg stream ended (code ${code})`);
        if (!res.writableEnded) {
          res.end();
        }
      });

    } catch (error: any) {
      console.error('Erro ao iniciar live stream:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao iniciar stream', details: error.message });
      }
    }
  }

  /**
   * Retorna canais configurados e canal padrão
   * GET /api/dvr-cftv/config/canais
   */
  static async getCanais(req: Request, res: Response) {
    try {
      const data = await DVRCFTVService.getCanaisConfig();
      res.json({ success: true, ...data });
    } catch (error: any) {
      console.error('Erro ao buscar canais:', error.message);
      res.status(500).json({ error: 'Erro ao buscar configuração de canais', details: error.message });
    }
  }

  /**
   * Testar conexão com o DVR
   * POST /api/dvr-cftv/test-connection
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const result = await DVRCFTVService.testConnection();
      res.json(result);
    } catch (error: any) {
      console.error('Erro ao testar conexão DVR:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Retorna câmeras configuradas para bipagens (açougue)
   * GET /api/dvr-cftv/config/cameras-bipagens
   */
  static async getCamerasBipagens(req: Request, res: Response) {
    try {
      const { ConfigurationService } = await import('../services/configuration.service');
      const raw = await ConfigurationService.get('dvr_cameras_bipagens');
      let cameras: { channel: number; label: string }[] = [];
      try {
        cameras = JSON.parse(raw || '[]');
      } catch { cameras = []; }
      res.json({ success: true, cameras });
    } catch (error: any) {
      console.error('Erro ao buscar câmeras bipagens:', error.message);
      res.status(500).json({ error: 'Erro ao buscar câmeras de bipagens', details: error.message });
    }
  }

  /**
   * Salvar câmeras configuradas para bipagens (açougue)
   * POST /api/dvr-cftv/config/cameras-bipagens
   */
  static async saveCamerasBipagens(req: Request, res: Response) {
    try {
      const { cameras } = req.body;
      if (!Array.isArray(cameras)) {
        return res.status(400).json({ error: 'cameras deve ser um array' });
      }
      const { ConfigurationService } = await import('../services/configuration.service');
      await ConfigurationService.set('dvr_cameras_bipagens', JSON.stringify(cameras));
      res.json({ success: true, message: 'Câmeras de bipagens salvas com sucesso' });
    } catch (error: any) {
      console.error('Erro ao salvar câmeras bipagens:', error.message);
      res.status(500).json({ error: 'Erro ao salvar câmeras de bipagens', details: error.message });
    }
  }

  /**
   * Buscar câmeras configuradas para Prev. Risco
   * GET /api/dvr-cftv/config/cameras-risco
   */
  static async getCamerasRisco(req: Request, res: Response) {
    try {
      const codigoLoja = req.query.codigo_loja != null ? parseInt(String(req.query.codigo_loja), 10) : null;

      if (codigoLoja != null && !Number.isNaN(codigoLoja)) {
        const { AppDataSource } = await import('../config/database');
        const { DvrDevice } = await import('../entities/DvrDevice');
        const repo = AppDataSource.getRepository(DvrDevice);
        const device = await repo.findOne({ where: { codigo_loja: codigoLoja, is_default: true, status: 'active' } })
          || await repo.findOne({ where: { codigo_loja: codigoLoja, status: 'active' } });
        if (device) {
          return res.json({ success: true, cameras: Array.isArray(device.cameras_risco) ? device.cameras_risco : [] });
        }
      }

      const { ConfigurationService } = await import('../services/configuration.service');
      const raw = await ConfigurationService.get('dvr_cameras_risco');
      let cameras: { channel: number; label: string; pdv: number; antes: number; depois: number }[] = [];
      try {
        cameras = JSON.parse(raw || '[]');
      } catch { cameras = []; }
      res.json({ success: true, cameras });
    } catch (error: any) {
      console.error('Erro ao buscar câmeras risco:', error.message);
      res.status(500).json({ error: 'Erro ao buscar câmeras de risco', details: error.message });
    }
  }

  /**
   * Busca Oracle-only por palavra-chave (sem DVR POS)
   * GET /api/dvr-cftv/pos/search-oracle?text=dinheiro&start=2026-03-10&end=2026-03-10&pdv=4
   */
  static async searchOracle(req: Request, res: Response) {
    try {
      const { text, barcode, start, end, pdv, codLoja, operador, valorMin, valorMax } = req.query;
      const textStr = text ? (text as string).trim() : '';
      const barcodeStr = barcode ? (barcode as string).trim() : '';
      const codOperador = operador != null && operador !== '' ? parseInt(operador as string) : undefined;
      const vMin = valorMin != null && valorMin !== '' ? Number(valorMin) : undefined;
      const vMax = valorMax != null && valorMax !== '' ? Number(valorMax) : undefined;
      const temCriterio = codOperador != null || vMin != null || vMax != null;
      if (!textStr && !barcodeStr && !temCriterio) {
        return res.status(400).json({ error: 'Informe "text", "barcode" ou um filtro (operador/valor)' });
      }
      const startDate = (start as string) || new Date().toISOString().slice(0, 10);
      const endDate = (end as string) || startDate;
      const pdvNum = pdv ? parseInt(pdv as string) : undefined;
      const codLojaNum = codLoja ? parseInt(codLoja as string) : undefined;

      console.log(`[VISION-PC2] Busca Oracle: text="${textStr}", barcode="${barcodeStr}", op=${codOperador ?? '-'}, valor=${vMin ?? '-'}..${vMax ?? '-'}, start=${startDate}, end=${endDate}, pdv=${pdvNum || 'TODOS'}, loja=${codLojaNum || 'TODAS'}`);
      const result = await DVRCFTVService.searchOracleAllPdvs(startDate, endDate, textStr, pdvNum, barcodeStr, codLojaNum, { codOperador, valorMin: vMin, valorMax: vMax });

      // Enriquece items com pre-clipe (Canc.Item/Cupom/Venda + Desconto pre-gerados pelo cron)
      const items = await DVRCFTVController.enrichWithPreClips(result.items, codLojaNum);

      res.json({ success: true, total: result.total, items });
    } catch (error: any) {
      console.error('Erro busca Oracle/PG:', error.message);
      res.status(500).json({ error: 'Erro ao buscar: ' + error.message, details: error.message });
    }
  }

  /**
   * Lista operadores/caixas do ERP pra popular o filtro do Vision Palavra-Chave.
   * GET /api/dvr-cftv/pos/operadores
   */
  static async getOperadores(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const operadores = await DVRCFTVService.getOperadores(start as string, end as string);
      res.json({ success: true, operadores });
    } catch (error: any) {
      console.error('Erro getOperadores:', error.message);
      res.status(500).json({ error: 'Erro ao listar operadores', details: error.message });
    }
  }

  /**
   * Cruza items retornados por searchOracleAllPdvs com a tabela dvr_pos_event_clips
   * pra adicionar clip_status e clip_filename. Permite o frontend mostrar botao Play
   * "verde" quando o clipe ja foi pre-gerado pelo cron.
   */
  private static async enrichWithPreClips(items: any[], codLoja?: number): Promise<any[]> {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    try {
      const { AppDataSource } = await import('../config/database');
      const { DvrPosEventClip } = await import('../entities/DvrPosEventClip');
      const repo = AppDataSource.getRepository(DvrPosEventClip);

      // Tipos que podem ter clipe pre-gerado.
      // FINALIZADORA cobre o filtro Funcionario, que o cron passou a varrer em 22/08.
      // As demais finalizadoras (PIX, Dinheiro, ...) nao sao pre-baixadas, mas o clipe
      // gerado sob demanda fica em dvr_pos_event_clips e e reaproveitado aqui.
      const TIPOS_PRE = new Set(['CANC. ITEM', 'CANC. CUPOM', 'CANC. VENDA', 'DESCONTO', 'FINALIZADORA']);

      // Constroi event_keys apenas dos items elegiveis
      const keys: string[] = [];
      for (const it of items) {
        const tipo = String(it.tipo || '').toUpperCase().trim();
        if (!TIPOS_PRE.has(tipo)) continue;
        const tipoKey = tipo.replace(/\s+/g, '').replace('.', '');
        const loja = codLoja ?? 1;
        keys.push(`${loja}|${it.pdv}|${it.cupomNum}|${tipoKey}|${it.time}`);
      }
      if (keys.length === 0) return items;

      const clips = await repo.createQueryBuilder('c')
        .where('c.event_key IN (:...keys)', { keys })
        .getMany();
      const byKey = new Map<string, { filename: string | null; status: string | null }>();
      for (const c of clips) byKey.set(c.event_key, { filename: c.filename, status: c.clip_status });

      return items.map((it: any) => {
        const tipo = String(it.tipo || '').toUpperCase().trim();
        if (!TIPOS_PRE.has(tipo)) return it;
        const tipoKey = tipo.replace(/\s+/g, '').replace('.', '');
        const loja = codLoja ?? 1;
        const k = `${loja}|${it.pdv}|${it.cupomNum}|${tipoKey}|${it.time}`;
        const hit = byKey.get(k);
        if (hit?.status === 'ready' && hit.filename) {
          return { ...it, clip_status: 'ready', clip_filename: hit.filename };
        }
        return it;
      });
    } catch (e: any) {
      console.error('[VISION-PC2] enrichWithPreClips erro:', e?.message || e);
      return items;
    }
  }

  /**
   * Salvar configuração de câmeras por PDV para Vision Palavra Chave 2
   * POST /api/dvr-cftv/config/cameras-pdv
   */
  static async saveCamerasPdv(req: Request, res: Response) {
    try {
      const { cameras } = req.body;
      if (!Array.isArray(cameras)) {
        return res.status(400).json({ error: 'cameras deve ser um array' });
      }
      const { ConfigurationService } = await import('../services/configuration.service');
      await ConfigurationService.set('dvr_cameras_pdv', JSON.stringify(cameras));
      res.json({ success: true, message: 'Configuração de câmeras por PDV salva' });
    } catch (error: any) {
      console.error('Erro ao salvar câmeras PDV:', error.message);
      res.status(500).json({ error: 'Erro ao salvar câmeras PDV', details: error.message });
    }
  }

  /**
   * Buscar configuração de câmeras por PDV para Vision Palavra Chave 2
   * GET /api/dvr-cftv/config/cameras-pdv
   */
  static async getCamerasPdv(req: Request, res: Response) {
    try {
      const codigoLoja = req.query.codigo_loja != null ? parseInt(String(req.query.codigo_loja), 10) : null;

      // 1) Tenta buscar do DVR da loja em dvr_devices
      if (codigoLoja != null && !Number.isNaN(codigoLoja)) {
        const { AppDataSource } = await import('../config/database');
        const { DvrDevice } = await import('../entities/DvrDevice');
        const repo = AppDataSource.getRepository(DvrDevice);
        const device = await repo.findOne({
          where: { codigo_loja: codigoLoja, is_default: true, status: 'active' }
        }) || await repo.findOne({
          where: { codigo_loja: codigoLoja, status: 'active' }
        });
        if (device) {
          return res.json({ success: true, cameras: Array.isArray(device.cameras_pdv) ? device.cameras_pdv : [] });
        }
      }

      // 2) Fallback legacy: le de configurations
      const { ConfigurationService } = await import('../services/configuration.service');
      const raw = await ConfigurationService.get('dvr_cameras_pdv');
      let cameras: { channel: number; label: string; pdv: number; antes: number; depois: number }[] = [];
      try { cameras = JSON.parse(raw || '[]'); } catch { cameras = []; }
      res.json({ success: true, cameras });
    } catch (error: any) {
      console.error('Erro ao buscar câmeras PDV:', error.message);
      res.status(500).json({ error: 'Erro ao buscar câmeras PDV', details: error.message });
    }
  }

  /**
   * Buscar produto pelo código de barras
   * GET /api/dvr-cftv/pos/produto-by-barcode?barcode=7896584300031
   */
  static async produtoByBarcode(req: Request, res: Response) {
    try {
      const { barcode } = req.query;
      if (!barcode || !(barcode as string).trim()) {
        return res.status(400).json({ error: 'Parâmetro "barcode" é obrigatório' });
      }
      const result = await DVRCFTVService.findProductByBarcode((barcode as string).trim());
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro ao buscar produto por barcode:', error.message);
      res.status(500).json({ error: 'Erro ao buscar produto', details: error.message });
    }
  }

  /**
   * Detectar canais do DVR automaticamente via RPC2
   * POST /api/dvr-cftv/detect-channels
   */
  static async detectChannels(req: Request, res: Response) {
    try {
      const result = await DVRCFTVService.detectChannels();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro ao detectar canais DVR:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
