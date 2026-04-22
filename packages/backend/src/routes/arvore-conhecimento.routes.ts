import { Router } from 'express';
import multer from 'multer';
import { ArvoreConhecimentoController } from '../controllers/arvore-conhecimento.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticateToken);

// Abas (por setor)
router.get('/abas', ArvoreConhecimentoController.listarAbas);
router.post('/abas', ArvoreConhecimentoController.criarAba);
router.put('/abas/:id', ArvoreConhecimentoController.atualizarAba);
router.delete('/abas/:id', ArvoreConhecimentoController.deletarAba);

// Notas (dentro de uma aba)
router.get('/notas', ArvoreConhecimentoController.listarNotas);
router.post('/notas', ArvoreConhecimentoController.criarNota);
router.put('/notas/:id', ArvoreConhecimentoController.atualizarNota);
router.delete('/notas/:id', ArvoreConhecimentoController.deletarNota);

// Anexos (upload de arquivo ou registro de link)
router.post('/anexos/upload', upload.single('arquivo'), ArvoreConhecimentoController.uploadAnexo);
router.post('/anexos/link', ArvoreConhecimentoController.criarAnexoLink);
router.delete('/anexos/:id', ArvoreConhecimentoController.deletarAnexo);

export default router;
