import { Request, Response } from 'express';
import { FaceRecognitionService } from '../services/face-recognition.service';

export class FaceRecognitionController {

  /**
   * Listar grupos do DVR
   * GET /api/face-recognition/groups
   */
  static async listGroups(req: Request, res: Response) {
    try {
      const groups = await FaceRecognitionService.listGroups();
      res.json({ success: true, groups });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao listar grupos:', error.message);
      res.status(500).json({ error: 'Erro ao listar grupos', details: error.message });
    }
  }

  /**
   * Listar pessoas cadastradas (com filtro opcional por grupo)
   * GET /api/face-recognition/persons?groupId=1&begin=0&count=20
   * Usa RPC2 quando groupId fornecido (retorna URLs de fotos), senão NetSDK
   */
  static async listPersons(req: Request, res: Response) {
    try {
      const { groupId, begin, count } = req.query;

      if (groupId) {
        // RPC2 retorna fotos
        try {
          const result = await FaceRecognitionService.findPersonsRPC(
            groupId as string,
            parseInt(begin as string) || 0,
            parseInt(count as string) || 20
          );
          return res.json({ success: true, total: result.total, persons: result.persons });
        } catch (rpcErr: any) {
          console.warn('[FaceRecognition] RPC fallback to NetSDK:', rpcErr.message);
        }
      }

      // Fallback: NetSDK (sem fotos)
      const result = await FaceRecognitionService.findPersons(
        groupId as string,
        parseInt(begin as string) || 0,
        parseInt(count as string) || 20
      );
      res.json({ success: true, total: result.total, persons: result.persons });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao listar pessoas:', error.message);
      res.status(500).json({ error: 'Erro ao listar pessoas', details: error.message });
    }
  }

  /**
   * Proxy para foto de pessoa do DVR
   * GET /api/face-recognition/person-photo?url=<photoUrl>
   */
  static async getPersonPhoto(req: Request, res: Response) {
    try {
      const photoUrl = req.query.url as string;
      if (!photoUrl) {
        return res.status(400).json({ error: 'URL da foto é obrigatória' });
      }

      const imgBuffer = await FaceRecognitionService.getPersonPhoto(photoUrl);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', imgBuffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(imgBuffer);
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao buscar foto:', error.message);
      res.status(500).json({ error: 'Erro ao buscar foto', details: error.message });
    }
  }

  /**
   * Proxy para imagem de deteccao facial do DVR
   * GET /api/face-recognition/detection-image?path=<filePath>
   */
  static async getDetectionImage(req: Request, res: Response) {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: 'Path da imagem e obrigatorio' });
      }

      const imgBuffer = await FaceRecognitionService.getDetectionImage(filePath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', imgBuffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(imgBuffer);
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao buscar imagem deteccao:', error.message);
      res.status(500).json({ error: 'Erro ao buscar imagem', details: error.message });
    }
  }

  /**
   * Cadastrar pessoa com foto
   * POST /api/face-recognition/persons
   * Body: { name, groupId, photoBase64, id?, sex?, age? }
   */
  static async addPerson(req: Request, res: Response) {
    try {
      const { name, groupId, photoBase64, id, sex, age } = req.body;

      if (!name || !groupId) {
        return res.status(400).json({ error: 'Nome e grupo são obrigatórios' });
      }
      if (!photoBase64) {
        return res.status(400).json({ error: 'Foto é obrigatória (photoBase64)' });
      }

      const result = await FaceRecognitionService.addPerson({
        name,
        groupId,
        photoBase64,
        id: id || '',
        sex: sex || 0,
        age: age || 0,
      });

      if (!result.success) {
        return res.status(400).json({ error: 'Falha ao cadastrar pessoa', details: result.error });
      }

      res.json({ success: true, uid: result.uid });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao cadastrar pessoa:', error.message);
      res.status(500).json({ error: 'Erro ao cadastrar pessoa', details: error.message });
    }
  }

  /**
   * Deletar pessoa pelo UID
   * DELETE /api/face-recognition/persons/:uid
   */
  static async deletePerson(req: Request, res: Response) {
    try {
      const { uid } = req.params;
      if (!uid) {
        return res.status(400).json({ error: 'UID é obrigatório' });
      }

      const result = await FaceRecognitionService.deletePerson(uid);
      if (!result.success) {
        return res.status(400).json({ error: 'Falha ao deletar pessoa', details: result.error });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao deletar pessoa:', error.message);
      res.status(500).json({ error: 'Erro ao deletar pessoa', details: error.message });
    }
  }

  /**
   * Buscar detecções faciais do dia
   * GET /api/face-recognition/detections?start=2026-03-06 00:00:00&end=2026-03-06 23:59:59&channel=0&max=100
   */
  static async searchDetections(req: Request, res: Response) {
    try {
      const { start, end, channel, max } = req.query;

      const startTime = (start as string) || new Date().toISOString().slice(0, 10) + ' 00:00:00';
      const endTime = (end as string) || new Date().toISOString().slice(0, 10) + ' 23:59:59';
      const ch = channel !== undefined && channel !== '' ? parseInt(channel as string) : undefined;
      const maxResults = parseInt(max as string) || 100;

      const result = await FaceRecognitionService.searchFaceDetections({
        startTime,
        endTime,
        channel: ch,
        maxResults,
      });

      res.json({ success: true, total: result.total, detections: result.detections });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao buscar deteccoes:', error.message);
      res.status(500).json({ error: 'Erro ao buscar deteccoes faciais', details: error.message });
    }
  }

  /**
   * Buscar eventos de detecção facial (legacy)
   * GET /api/face-recognition/events
   */
  static async searchEvents(req: Request, res: Response) {
    try {
      const { start, end, channel } = req.query;

      const startTime = (start as string) || new Date().toISOString().slice(0, 10) + ' 00:00:00';
      const endTime = (end as string) || new Date().toISOString().slice(0, 10) + ' 23:59:59';
      const ch = channel !== undefined ? parseInt(channel as string) : undefined;

      const events = await FaceRecognitionService.searchFaceEvents({
        startTime,
        endTime,
        channel: ch,
      });

      res.json({ success: true, total: events.length, events });
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao buscar eventos:', error.message);
      res.status(500).json({ error: 'Erro ao buscar eventos faciais', details: error.message });
    }
  }

  /**
   * Capturar snapshot de uma câmera
   * GET /api/face-recognition/snapshot?channel=1
   */
  static async getSnapshot(req: Request, res: Response) {
    try {
      const channel = parseInt(req.query.channel as string) || 1;
      const imgBuffer = await FaceRecognitionService.getSnapshot(channel);

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', imgBuffer.length.toString());
      res.send(imgBuffer);
    } catch (error: any) {
      console.error('[FaceRecognition] Erro ao capturar snapshot:', error.message);
      res.status(500).json({ error: 'Erro ao capturar snapshot', details: error.message });
    }
  }
}
