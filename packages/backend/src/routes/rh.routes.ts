import { Router } from 'express';
import { RhController } from '../controllers/rh.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.get('/colaboradores', authenticateToken, RhController.listColaboradores);
router.get('/colaboradores/stats', authenticateToken, RhController.getStats);
router.get('/colaboradores/:id', authenticateToken, RhController.getColaboradorById);
router.post('/colaboradores', authenticateToken, RhController.createColaborador);
router.put('/colaboradores/:id', authenticateToken, RhController.updateColaborador);
router.delete('/colaboradores/:id', authenticateToken, RhController.deleteColaborador);

// Configuracoes - Cargos
router.get('/configuracoes/cargos', authenticateToken, RhController.listarCargos);
router.post('/configuracoes/cargos', authenticateToken, RhController.criarCargo);
router.put('/configuracoes/cargos/:id', authenticateToken, RhController.atualizarCargo);
router.delete('/configuracoes/cargos/:id', authenticateToken, RhController.deletarCargo);

// Configuracoes - Empresas
router.get('/configuracoes/empresas', authenticateToken, RhController.listarEmpresas);
router.post('/configuracoes/empresas', authenticateToken, RhController.criarEmpresa);
router.put('/configuracoes/empresas/:id', authenticateToken, RhController.atualizarEmpresa);
router.delete('/configuracoes/empresas/:id', authenticateToken, RhController.deletarEmpresa);

// Configuracoes - Jornadas
router.get('/configuracoes/jornadas', authenticateToken, RhController.listarJornadas);
router.post('/configuracoes/jornadas', authenticateToken, RhController.criarJornada);
router.put('/configuracoes/jornadas/:id', authenticateToken, RhController.atualizarJornada);
router.delete('/configuracoes/jornadas/:id', authenticateToken, RhController.deletarJornada);

// Configuracoes - Escolaridades
router.get('/configuracoes/escolaridades', authenticateToken, RhController.listarEscolaridades);
router.post('/configuracoes/escolaridades', authenticateToken, RhController.criarEscolaridade);
router.put('/configuracoes/escolaridades/:id', authenticateToken, RhController.atualizarEscolaridade);
router.delete('/configuracoes/escolaridades/:id', authenticateToken, RhController.deletarEscolaridade);

// Configuracoes - Escalas
router.get('/configuracoes/escalas', authenticateToken, RhController.listarEscalas);
router.post('/configuracoes/escalas', authenticateToken, RhController.criarEscala);
router.put('/configuracoes/escalas/:id', authenticateToken, RhController.atualizarEscala);
router.delete('/configuracoes/escalas/:id', authenticateToken, RhController.deletarEscala);

// Configuracoes - Regimes de Trabalho
router.get('/configuracoes/regimes-trabalho', authenticateToken, RhController.listarRegimesTrabalho);
router.post('/configuracoes/regimes-trabalho', authenticateToken, RhController.criarRegimeTrabalho);
router.put('/configuracoes/regimes-trabalho/:id', authenticateToken, RhController.atualizarRegimeTrabalho);
router.delete('/configuracoes/regimes-trabalho/:id', authenticateToken, RhController.deletarRegimeTrabalho);

// Configuracoes - Formas de Pagamento
router.get('/configuracoes/formas-pagamento', authenticateToken, RhController.listarFormasPagamento);
router.post('/configuracoes/formas-pagamento', authenticateToken, RhController.criarFormaPagamento);
router.put('/configuracoes/formas-pagamento/:id', authenticateToken, RhController.atualizarFormaPagamento);
router.delete('/configuracoes/formas-pagamento/:id', authenticateToken, RhController.deletarFormaPagamento);

// Configuracoes - Prazos de Experiencia
router.get('/configuracoes/prazos-experiencia', authenticateToken, RhController.listarPrazosExperiencia);
router.post('/configuracoes/prazos-experiencia', authenticateToken, RhController.criarPrazoExperiencia);
router.put('/configuracoes/prazos-experiencia/:id', authenticateToken, RhController.atualizarPrazoExperiencia);
router.delete('/configuracoes/prazos-experiencia/:id', authenticateToken, RhController.deletarPrazoExperiencia);

// Configuracoes - Tipos de Desligamento
router.get('/configuracoes/tipos-desligamento', authenticateToken, RhController.listarTiposDesligamento);
router.post('/configuracoes/tipos-desligamento', authenticateToken, RhController.criarTipoDesligamento);
router.put('/configuracoes/tipos-desligamento/:id', authenticateToken, RhController.atualizarTipoDesligamento);
router.delete('/configuracoes/tipos-desligamento/:id', authenticateToken, RhController.deletarTipoDesligamento);

// Configuracoes - Motivos de Desligamento
router.get('/configuracoes/motivos-desligamento', authenticateToken, RhController.listarMotivosDesligamento);
router.post('/configuracoes/motivos-desligamento', authenticateToken, RhController.criarMotivoDesligamento);
router.put('/configuracoes/motivos-desligamento/:id', authenticateToken, RhController.atualizarMotivoDesligamento);
router.delete('/configuracoes/motivos-desligamento/:id', authenticateToken, RhController.deletarMotivoDesligamento);

export default router;
