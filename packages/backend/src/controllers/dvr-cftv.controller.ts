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
      const { time, channel, cupomNum } = req.query;
      if (!time) {
        return res.status(400).json({ error: 'Parâmetro "time" é obrigatório' });
      }

      const canalConfig3 = await DVRCFTVService.getCanaisConfig();
      const ch = channel !== undefined ? parseInt(channel as string) : canalConfig3.canalPadrao;
      const cupomNumParsed = cupomNum ? parseInt(cupomNum as string) : undefined;

      console.log(`[DVR] getCupom: time="${time}", channel=${ch}, cupomNum=${cupomNumParsed || 'auto'}`);
      const cupom = await DVRCFTVService.getCupomByTime(time as string, ch, cupomNumParsed);

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
      const { text, barcode, start, end, pdv } = req.query;
      const textStr = text ? (text as string).trim() : '';
      const barcodeStr = barcode ? (barcode as string).trim() : '';
      if (!textStr && !barcodeStr) {
        return res.status(400).json({ error: 'Parâmetro "text" ou "barcode" é obrigatório' });
      }
      const startDate = (start as string) || new Date().toISOString().slice(0, 10);
      const endDate = (end as string) || startDate;
      const pdvNum = pdv ? parseInt(pdv as string) : undefined;

      console.log(`[VISION-PC2] Busca Oracle: text="${textStr}", barcode="${barcodeStr}", start=${startDate}, end=${endDate}, pdv=${pdvNum || 'TODOS'}`);
      const result = await DVRCFTVService.searchOracleAllPdvs(startDate, endDate, textStr, pdvNum, barcodeStr);

      res.json({ success: true, total: result.total, items: result.items });
    } catch (error: any) {
      console.error('Erro busca Oracle:', error.message);
      res.status(500).json({ error: 'Erro ao buscar no Oracle', details: error.message });
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
