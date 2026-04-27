import { Router, IRouter } from 'express';
import { RhRecrutadorController } from '../controllers/rh-recrutador.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Endpoints publicos (candidato usa o token, sem login)
router.get('/publico/:token', RhRecrutadorController.publicoCarregar);
router.post('/publico/:token/responder', RhRecrutadorController.publicoResponder);

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

// TTS preview (testar voz antes de enviar)
router.post('/tts/preview', RhRecrutadorController.ttsPreview);

export default router;
