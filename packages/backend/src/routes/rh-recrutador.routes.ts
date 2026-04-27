import { Router, IRouter } from 'express';
import multer from 'multer';
import { RhRecrutadorController } from '../controllers/rh-recrutador.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Multer pra upload de video da entrevista (memoria, depois sobe pro MinIO)
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max por entrevista
});

// Endpoints publicos (candidato usa o token, sem login)
router.get('/publico/:token', RhRecrutadorController.publicoCarregar);
router.post('/publico/:token/responder', RhRecrutadorController.publicoResponder);
router.post('/publico/:token/tts', RhRecrutadorController.publicoTts);
router.post('/publico/:token/video', uploadVideo.single('video'), RhRecrutadorController.publicoUploadVideo);
router.post('/publico/criar-preentrevista', RhRecrutadorController.publicoCriarPreEntrevista);

// Daqui pra baixo - autenticado (RH)
router.use(authenticateToken);

// Vagas
router.get('/vagas', RhRecrutadorController.listarVagas);
router.post('/vagas', RhRecrutadorController.criarVaga);
router.put('/vagas/:id', RhRecrutadorController.atualizarVaga);
router.delete('/vagas/:id', RhRecrutadorController.deletarVaga);

// Banco de Perguntas
router.get('/perguntas', RhRecrutadorController.listarPerguntas);
router.post('/perguntas', RhRecrutadorController.criarPergunta);
router.put('/perguntas/:id', RhRecrutadorController.atualizarPergunta);
router.delete('/perguntas/:id', RhRecrutadorController.deletarPergunta);

// Configuracao da agente
router.get('/config', RhRecrutadorController.getConfig);
router.put('/config', RhRecrutadorController.putConfig);

// Entrevistas
router.get('/entrevistas', RhRecrutadorController.listarEntrevistas);
router.get('/entrevistas/:id', RhRecrutadorController.detalheEntrevista);
router.post('/entrevistas', RhRecrutadorController.criarEntrevista);
router.delete('/entrevistas/:id', RhRecrutadorController.deletarEntrevista);
router.post('/entrevistas/:id/regerar-relatorio', RhRecrutadorController.regerarRelatorio);

// TTS preview (testar voz antes de enviar)
router.post('/tts/preview', RhRecrutadorController.ttsPreview);

export default router;
