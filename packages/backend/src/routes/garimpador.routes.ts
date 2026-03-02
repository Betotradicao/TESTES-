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

// Processamento de mensagens (extração de dados)
router.post('/processar', GarimpadorController.processarTodas);
router.post('/processar/:id', GarimpadorController.processarUma);

// Comparação com Oracle + envio para WhatsApp
router.post('/comparar', GarimpadorController.compararTodas);
router.post('/comparar/:id', GarimpadorController.compararUma);
router.post('/buscar-produto', GarimpadorController.buscarProduto);

export default router;
