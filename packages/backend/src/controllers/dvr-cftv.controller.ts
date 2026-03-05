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

      const ch = parseInt(channel as string) || 3;
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

      const ch = parseInt(channel as string) || 3;
      const dur = parseInt(duration as string) || 15;

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
      const { time, channel } = req.query;
      if (!time) {
        return res.status(400).json({ error: 'Parâmetro "time" é obrigatório' });
      }

      const ch = parseInt(channel as string) || 3;
      // Canal DVR (0-based) + 1 = PDV number
      const pdv = ch + 1;

      console.log(`[DVR] getCupom: time="${time}", channel=${ch}, pdv=${pdv}`);
      const cupom = await DVRCFTVService.getCupomByTime(time as string, pdv);

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
}
