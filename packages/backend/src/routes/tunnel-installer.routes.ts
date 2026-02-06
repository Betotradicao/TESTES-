import { Router, IRouter } from 'express';
import { TunnelInstallerController } from '../controllers/tunnel-installer.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();
const controller = new TunnelInstallerController();

// Informações sobre o instalador (requer autenticação)
router.get('/info', authenticateToken, controller.getInfo.bind(controller));

// Status dos túneis instalados (requer autenticação)
router.get('/status', authenticateToken, controller.getStatus.bind(controller));

// Gerar scripts personalizados (requer autenticação)
router.post('/generate', authenticateToken, controller.generateInstaller.bind(controller));

// Testar conexão dos túneis (requer autenticação)
router.post('/test', authenticateToken, controller.testTunnels.bind(controller));

// Download de script específico (requer autenticação)
router.post('/download/:type', authenticateToken, controller.downloadScript.bind(controller));

// Desinstalar túnel (remove chave + gera BAT de remoção)
router.post('/uninstall', authenticateToken, controller.uninstallTunnel.bind(controller));

export default router;
