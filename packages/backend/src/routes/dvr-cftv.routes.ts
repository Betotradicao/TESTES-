import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DVRCFTVController } from '../controllers/dvr-cftv.controller';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router: Router = Router();

// Middleware que aceita token via query param (para <video src="url?token=xxx">)
const authenticateTokenOrQuery = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = req.query.token as string;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'development-secret', (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    req.userId = user.id;
    next();
  });
};

// Buscar transações POS por texto
router.get('/pos/search', authenticateToken, DVRCFTVController.searchPOS);

// Gerar clipe MP4 (aguarda ffmpeg terminar)
router.get('/pos/generate-clip', authenticateToken, DVRCFTVController.generateClip);

// Buscar cupom/nota do Oracle pelo timestamp DVR
router.get('/pos/cupom', authenticateToken, DVRCFTVController.getCupom);

// Servir clipe MP4 já gerado (aceita token via query param para <video>)
router.get('/pos/stream/:filename', authenticateTokenOrQuery, DVRCFTVController.streamClip);

// Streaming RTSP direto do DVR (aceita token via query param para <video>)
router.get('/pos/live-stream', authenticateTokenOrQuery, DVRCFTVController.liveStream);

// Configuração de canais DVR
router.get('/config/canais', authenticateToken, DVRCFTVController.getCanais);

// Câmeras de bipagens (açougue)
router.get('/config/cameras-bipagens', authenticateToken, DVRCFTVController.getCamerasBipagens);
router.post('/config/cameras-bipagens', authenticateToken, DVRCFTVController.saveCamerasBipagens);

// Câmeras de Prev. Risco (por PDV)
router.get('/config/cameras-risco', authenticateToken, DVRCFTVController.getCamerasRisco);

// Testar conexão com o DVR
router.post('/test-connection', authenticateToken, DVRCFTVController.testConnection);

// Detectar canais do DVR automaticamente
router.post('/detect-channels', authenticateToken, DVRCFTVController.detectChannels);

export default router;
