import { Router } from 'express';
import multer from 'multer';
import { CurriculosController } from '../controllers/curriculos.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============ PUBLICO (sem auth) ============
// Formulario carregado pelo candidato + envio do curriculo
router.get('/publico/formulario', CurriculosController.obterFormularioPublico);
router.get('/publico/vagas', CurriculosController.listarVagasPublicasPorLoja);
router.post('/publico/upload-foto', upload.single('foto'), CurriculosController.uploadFotoPublico);
router.post('/publico/enviar', CurriculosController.enviarCurriculoPublico);

// ============ AUTENTICADO ============
router.use(authenticateToken);

// Catalogo de cargos
router.get('/cargos', CurriculosController.listarCargos);
router.post('/cargos', CurriculosController.criarCargo);
router.put('/cargos/:id', CurriculosController.atualizarCargo);
router.delete('/cargos/:id', CurriculosController.deletarCargo);

// Catalogo de habilidades
router.get('/habilidades', CurriculosController.listarHabilidades);
router.post('/habilidades', CurriculosController.criarHabilidade);
router.put('/habilidades/:id', CurriculosController.atualizarHabilidade);
router.delete('/habilidades/:id', CurriculosController.deletarHabilidade);

// Catalogo de tipos de vaga (CLT, Aprendiz, etc — editavel)
router.get('/tipos-vaga', CurriculosController.listarTiposVaga);
router.post('/tipos-vaga', CurriculosController.criarTipoVaga);
router.put('/tipos-vaga/:id', CurriculosController.atualizarTipoVaga);
router.delete('/tipos-vaga/:id', CurriculosController.deletarTipoVaga);

// Banco de curriculos
router.get('/', CurriculosController.listarCurriculos);
router.get('/:id', CurriculosController.obterCurriculo);
router.put('/:id', CurriculosController.atualizarCurriculo);
router.delete('/:id', CurriculosController.deletarCurriculo);

export default router;
