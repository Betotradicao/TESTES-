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

// Analytics
router.get('/analytics/resumo', GarimpadorController.getResumoAnalytics);
router.get('/analytics/ranking', GarimpadorController.getRankingFornecedores);
router.get('/analytics/ranking/:contatoId', GarimpadorController.getDetalhesFornecedor);
router.get('/analytics/projecao', GarimpadorController.getProjecaoPreco);
router.get('/analytics/fora-mix', GarimpadorController.getProdutosForaMix);
router.get('/produtos-pesquisar', GarimpadorController.getProdutosPesquisar);
router.get('/produtos-excluidos', GarimpadorController.getProdutosExcluidos);
router.post('/produtos-excluidos', GarimpadorController.salvarProdutosExcluidos);

// Multi-loja (lojas participantes + modo de referencia de custo)
router.get('/lojas', GarimpadorController.listarLojas);
router.get('/lojas-config', GarimpadorController.getLojasConfig);
router.post('/lojas-config', GarimpadorController.saveLojasConfig);

// Config do algoritmo de matching
router.get('/match-config', GarimpadorController.getMatchConfig);
router.post('/match-config', GarimpadorController.saveMatchConfig);
router.post('/test-match', GarimpadorController.testMatch);
router.post('/reprocessar', GarimpadorController.reprocessarTodos);

// VectorStore (PGVector)
router.post('/vectorstore/sync', GarimpadorController.syncVectorStore);
router.get('/vectorstore/stats', GarimpadorController.vectorStoreStats);
router.get('/vectorstore/search', GarimpadorController.vectorStoreSearch);

// OpenAI Balance
router.get('/openai-balance', GarimpadorController.getOpenAIBalance);

export default router;
