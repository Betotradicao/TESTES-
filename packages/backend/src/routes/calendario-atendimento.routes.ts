/**
 * Calendário de Atendimento Routes
 * Rotas para gestão de atendimento de fornecedores
 */

import { Router } from 'express';
import { CalendarioAtendimentoController } from '../controllers/calendario-atendimento.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Lista fornecedores com dados cadastrais
router.get('/fornecedores', CalendarioAtendimentoController.listarFornecedores);

// Visão mensal de entregas
router.get('/visao-mensal', CalendarioAtendimentoController.visaoMensal);

// Atendimento diário detalhado
router.get('/atendimento-diario', CalendarioAtendimentoController.atendimentoDiario);

// Lista classificações (para filtro)
router.get('/classificacoes', CalendarioAtendimentoController.listarClassificacoes);

// Mapa leve de nomes de fornecedores
router.get('/fornecedores-nomes', CalendarioAtendimentoController.listarFornecedoresNomes);

// Agendamentos de fornecedores (PostgreSQL)
router.get('/agendamentos', CalendarioAtendimentoController.getAgendamentos);
router.put('/agendamentos/:codFornecedor', CalendarioAtendimentoController.upsertAgendamento);

export default router;
