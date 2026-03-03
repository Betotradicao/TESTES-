/**
 * Frente de Caixa Routes
 * Rotas para relatórios de vendas, cancelamentos, descontos e diferença de caixa
 */

import { Router, type Router as RouterType } from 'express';
import { FrenteCaixaController } from '../controllers/frente-caixa.controller';

const router: RouterType = Router();

// Teste de conexão
router.get('/test-connection', FrenteCaixaController.testConnection);

// Lista operadores disponíveis
router.get('/operadores', FrenteCaixaController.getOperadores);

// Resumo consolidado por operador
router.get('/resumo', FrenteCaixaController.getResumoOperadores);

// Detalhe por dia de um operador
router.get('/detalhe-dia', FrenteCaixaController.getDetalheOperadorPorDia);

// Totais gerais do período
router.get('/totais', FrenteCaixaController.getTotais);

// Cupons de um operador em uma data específica
router.get('/cupons', FrenteCaixaController.getCuponsPorDia);

// Itens de um cupom específico
router.get('/itens', FrenteCaixaController.getItensPorCupom);

// Estornos órfãos de um operador em uma data (Canc. Cupom)
router.get('/estornos-orfaos', FrenteCaixaController.getEstornosOrfaos);

// Persistencia de horas trabalhadas e metas
router.get('/config/horas', FrenteCaixaController.getHorasConfig);
router.post('/config/horas', FrenteCaixaController.saveHorasConfig);
router.get('/config/metas', FrenteCaixaController.getMetasConfig);
router.post('/config/metas', FrenteCaixaController.saveMetasConfig);

export default router;
