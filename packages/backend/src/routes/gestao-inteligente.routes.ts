/**
 * Gestao Inteligente Routes
 * Rotas para consulta de indicadores consolidados de vendas
 */

import { Router } from 'express';
import { GestaoInteligenteController } from '../controllers/gestao-inteligente.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Busca indicadores consolidados
router.get('/indicadores', GestaoInteligenteController.getIndicadores);

// Lista lojas disponíveis
router.get('/lojas', GestaoInteligenteController.getLojas);

// Limpa o cache (força recarga do Oracle)
router.post('/clear-cache', GestaoInteligenteController.clearCache);

// Vendas por setor
router.get('/vendas-por-setor', GestaoInteligenteController.getVendasPorSetor);

// Hierarquia: Grupos por Seção
router.get('/grupos-por-secao', GestaoInteligenteController.getGruposPorSecao);

// Hierarquia: Subgrupos por Grupo
router.get('/subgrupos-por-grupo', GestaoInteligenteController.getSubgruposPorGrupo);

// Hierarquia: Itens por Subgrupo
router.get('/itens-por-subgrupo', GestaoInteligenteController.getItensPorSubgrupo);

// Vendas Analíticas por Setor (com comparativos)
router.get('/vendas-analiticas-setor', GestaoInteligenteController.getVendasAnaliticasPorSetor);

// Analíticos em cascata (grupos, subgrupos, itens com comparativos)
router.get('/grupos-analiticos', GestaoInteligenteController.getGruposAnaliticos);
router.get('/subgrupos-analiticos', GestaoInteligenteController.getSubgruposAnaliticos);
router.get('/itens-analiticos', GestaoInteligenteController.getItensAnaliticos);

// Vendas por Ano (mensal)
router.get('/vendas-por-ano', GestaoInteligenteController.getVendasPorAno);

// Vendas por Setor Anual (mensal, agrupado por setor)
router.get('/vendas-por-setor-anual', GestaoInteligenteController.getVendasPorSetorAnual);

// Vendas por Dia da Semana (mensal, com feriados)
router.get('/vendas-por-dia-semana', GestaoInteligenteController.getVendasPorDiaSemana);

// Produtos Revenda + Valor Estoque
router.get('/produtos-revenda-estoque', GestaoInteligenteController.getProdutosRevendaEstoque);

export default router;
