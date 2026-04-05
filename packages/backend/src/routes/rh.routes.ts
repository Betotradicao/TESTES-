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

// Configuracoes - Departamentos
router.get('/configuracoes/departamentos', authenticateToken, RhController.listarDepartamentos);
router.post('/configuracoes/departamentos', authenticateToken, RhController.criarDepartamento);
router.put('/configuracoes/departamentos/:id', authenticateToken, RhController.atualizarDepartamento);
router.delete('/configuracoes/departamentos/:id', authenticateToken, RhController.deletarDepartamento);

// Configuracoes - Tipos de Ausencia
router.get('/configuracoes/tipos-ausencia', authenticateToken, RhController.listarTiposAusencia);
router.post('/configuracoes/tipos-ausencia', authenticateToken, RhController.criarTipoAusencia);
router.put('/configuracoes/tipos-ausencia/:id', authenticateToken, RhController.atualizarTipoAusencia);
router.delete('/configuracoes/tipos-ausencia/:id', authenticateToken, RhController.deletarTipoAusencia);

// Configuracoes - Motivos de Ausencia
router.get('/configuracoes/motivos-ausencia', authenticateToken, RhController.listarMotivosAusencia);
router.post('/configuracoes/motivos-ausencia', authenticateToken, RhController.criarMotivoAusencia);
router.put('/configuracoes/motivos-ausencia/:id', authenticateToken, RhController.atualizarMotivoAusencia);
router.delete('/configuracoes/motivos-ausencia/:id', authenticateToken, RhController.deletarMotivoAusencia);

// Configuracoes - Tipos de Treinamento
router.get('/configuracoes/tipos-treinamento', authenticateToken, RhController.listarTiposTreinamento);
router.post('/configuracoes/tipos-treinamento', authenticateToken, RhController.criarTipoTreinamento);
router.put('/configuracoes/tipos-treinamento/:id', authenticateToken, RhController.atualizarTipoTreinamento);
router.delete('/configuracoes/tipos-treinamento/:id', authenticateToken, RhController.deletarTipoTreinamento);

// Configuracoes - Status de Treinamento
router.get('/configuracoes/status-treinamento', authenticateToken, RhController.listarStatusTreinamento);
router.post('/configuracoes/status-treinamento', authenticateToken, RhController.criarStatusTreinamento);
router.put('/configuracoes/status-treinamento/:id', authenticateToken, RhController.atualizarStatusTreinamento);
router.delete('/configuracoes/status-treinamento/:id', authenticateToken, RhController.deletarStatusTreinamento);

// ASO
router.get('/aso', authenticateToken, RhController.listarAso);
router.post('/aso', authenticateToken, RhController.criarAso);
router.put('/aso/:id', authenticateToken, RhController.atualizarAso);
router.delete('/aso/:id', authenticateToken, RhController.deletarAso);

// Ausencias
router.get('/ausencias', authenticateToken, RhController.listarAusencias);
router.post('/ausencias', authenticateToken, RhController.criarAusencia);
router.put('/ausencias/:id', authenticateToken, RhController.atualizarAusencia);
router.delete('/ausencias/:id', authenticateToken, RhController.deletarAusencia);

// Treinamentos
router.get('/treinamentos', authenticateToken, RhController.listarTreinamentos);
router.post('/treinamentos', authenticateToken, RhController.criarTreinamento);
router.put('/treinamentos/:id', authenticateToken, RhController.atualizarTreinamento);
router.delete('/treinamentos/:id', authenticateToken, RhController.deletarTreinamento);

// Vagas (Recrutamento)
router.get('/vagas', authenticateToken, RhController.listarVagas);
router.post('/vagas', authenticateToken, RhController.criarVaga);
router.put('/vagas/:id', authenticateToken, RhController.atualizarVaga);
router.delete('/vagas/:id', authenticateToken, RhController.deletarVaga);

// Candidatos
router.get('/candidatos', authenticateToken, RhController.listarCandidatos);
router.post('/candidatos', authenticateToken, RhController.criarCandidato);
router.put('/candidatos/:id', authenticateToken, RhController.atualizarCandidato);
router.delete('/candidatos/:id', authenticateToken, RhController.deletarCandidato);

// Lancamentos Financeiros (Folha)
router.get('/lancamentos-financeiros', authenticateToken, RhController.listarLancamentosFinanceiros);
router.post('/lancamentos-financeiros', authenticateToken, RhController.criarLancamentoFinanceiro);
router.put('/lancamentos-financeiros/:id', authenticateToken, RhController.atualizarLancamentoFinanceiro);
router.delete('/lancamentos-financeiros/:id', authenticateToken, RhController.deletarLancamentoFinanceiro);

// Dependentes
router.get('/dependentes', authenticateToken, RhController.listarDependentes);
router.post('/dependentes', authenticateToken, RhController.criarDependente);
router.put('/dependentes/:id', authenticateToken, RhController.atualizarDependente);
router.delete('/dependentes/:id', authenticateToken, RhController.deletarDependente);

// Historico de Alteracoes
router.get('/historico-alteracoes', authenticateToken, RhController.listarHistoricoAlteracoes);
router.post('/historico-alteracoes', authenticateToken, RhController.criarHistoricoAlteracao);
router.put('/historico-alteracoes/:id', authenticateToken, RhController.atualizarHistoricoAlteracao);
router.delete('/historico-alteracoes/:id', authenticateToken, RhController.deletarHistoricoAlteracao);

export default router;
