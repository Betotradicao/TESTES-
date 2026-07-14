import { Router } from 'express';
import { MktChatbotController } from '../controllers/mkt-chatbot.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Webhook publico — Evolution chama aqui (sem autenticacao)
router.post('/webhook', MktChatbotController.webhook);

router.use(authenticateToken);

// Fluxos
router.get('/fluxos', MktChatbotController.listarFluxos);
router.get('/fluxos/:id', MktChatbotController.obterFluxoCompleto);
router.post('/fluxos', MktChatbotController.criarFluxo);
router.put('/fluxos/:id', MktChatbotController.atualizarFluxo);
router.delete('/fluxos/:id', MktChatbotController.deletarFluxo);
router.post('/fluxos/seed-exemplos', MktChatbotController.seedExemplos);

// Menu simples (numero -> resposta) por cima do grafo
router.get('/fluxos/:id/menu', MktChatbotController.obterMenu);
router.put('/fluxos/:id/menu', MktChatbotController.salvarMenu);

// Blocos
router.post('/blocos', MktChatbotController.criarBloco);
router.put('/blocos/:id', MktChatbotController.atualizarBloco);
router.delete('/blocos/:id', MktChatbotController.deletarBloco);

// Conexoes
router.post('/conexoes', MktChatbotController.criarConexao);
router.put('/conexoes/:id', MktChatbotController.atualizarConexao);
router.delete('/conexoes/:id', MktChatbotController.deletarConexao);

// Conversas
router.get('/conversas', MktChatbotController.listarConversas);
router.get('/sessoes/:id/mensagens', MktChatbotController.listarMensagensSessao);

export default router;
