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

// Detalhes completos dos fornecedores (contato, email, prazo pgto)
router.get('/fornecedores-detalhes', CalendarioAtendimentoController.listarFornecedoresDetalhes);

// Pedidos emitidos em um dia específico
router.get('/pedidos-dia', CalendarioAtendimentoController.pedidosDoDia);

// Agendamentos de fornecedores (PostgreSQL)
router.get('/agendamentos', CalendarioAtendimentoController.getAgendamentos);
router.put('/agendamentos/:codFornecedor', CalendarioAtendimentoController.upsertAgendamento);

// Opções de dropdown (comprador / tipo_atendimento)
router.get('/opcoes-dropdown', CalendarioAtendimentoController.getOpcoesDropdown);
router.post('/opcoes-dropdown', CalendarioAtendimentoController.addOpcaoDropdown);
router.delete('/opcoes-dropdown/:id', CalendarioAtendimentoController.removeOpcaoDropdown);

export default router;
