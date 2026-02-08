import { Router, IRouter } from 'express';
import { TunnelInstallerController } from '../controllers/tunnel-installer.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();
const controller = new TunnelInstallerController();

// Defaults (portas de túnel e IP da VPS) para pré-preencher formulário
router.get('/defaults', authenticateToken, controller.getDefaults.bind(controller));

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
