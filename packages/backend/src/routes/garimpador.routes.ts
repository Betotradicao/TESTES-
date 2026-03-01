import { Router } from 'express';
import { GarimpadorController } from '../controllers/garimpador.controller';

const router: Router = Router();

// Webhook da Evolution API (público, sem autenticação)
router.post('/webhook', GarimpadorController.webhook);

// Rotas
router.get('/contatos', GarimpadorController.listarContatos);
router.put('/contatos/:id/tipo', GarimpadorController.atualizarTipoContato);
router.get('/mensagens', GarimpadorController.listarMensagens);
router.get('/estatisticas', GarimpadorController.getEstatisticas);

// Configuração do webhook na Evolution API
router.post('/configurar-webhook', GarimpadorController.configurarWebhook);
router.get('/webhook-status', GarimpadorController.webhookStatus);

export default router;
