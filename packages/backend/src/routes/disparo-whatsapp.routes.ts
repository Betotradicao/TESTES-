import { Router, IRouter } from 'express';
import { DisparoWhatsAppController } from '../controllers/disparo-whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Webhook público (Evolution API chama sem auth)
router.post('/webhook', DisparoWhatsAppController.webhook);

// Stats
router.get('/stats', authenticateToken, DisparoWhatsAppController.getStats);

// Contatos
router.get('/contatos', authenticateToken, DisparoWhatsAppController.listContacts);
router.post('/contatos', authenticateToken, DisparoWhatsAppController.createContact);
router.put('/contatos/:id', authenticateToken, DisparoWhatsAppController.updateContact);
router.delete('/contatos/:id', authenticateToken, DisparoWhatsAppController.deleteContact);
router.post('/contatos/delete-multiple', authenticateToken, DisparoWhatsAppController.deleteMultipleContacts);
router.post('/contatos/import', authenticateToken, DisparoWhatsAppController.importContacts);
router.post('/contatos/sync-whatsapp', authenticateToken, DisparoWhatsAppController.syncFromWhatsApp);
router.post('/contatos/:id/reactivate', authenticateToken, DisparoWhatsAppController.reactivateContact);

// Campanhas
router.get('/campanhas', authenticateToken, DisparoWhatsAppController.listCampaigns);
router.post('/campanhas', authenticateToken, DisparoWhatsAppController.createCampaign);
router.put('/campanhas/:id', authenticateToken, DisparoWhatsAppController.updateCampaign);
router.delete('/campanhas/:id', authenticateToken, DisparoWhatsAppController.deleteCampaign);
router.post('/campanhas/:id/start', authenticateToken, DisparoWhatsAppController.startCampaign);
router.post('/campanhas/:id/pause', authenticateToken, DisparoWhatsAppController.pauseCampaign);
router.post('/campanhas/:id/resume', authenticateToken, DisparoWhatsAppController.resumeCampaign);
router.post('/campanhas/:id/cancel', authenticateToken, DisparoWhatsAppController.cancelCampaign);
router.get('/campanhas/:id/messages', authenticateToken, DisparoWhatsAppController.getCampaignMessages);

export default router;
