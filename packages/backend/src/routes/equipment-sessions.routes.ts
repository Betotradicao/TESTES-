import { Router, type Router as RouterType } from 'express';
import { EquipmentSessionsController } from '../controllers/equipment-sessions.controller';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router: RouterType = Router();

// GET routes - available for all authenticated users (for viewing scanner status)
router.get('/active', authenticateToken, EquipmentSessionsController.getAllActiveSessions);
router.get('/equipment/:equipmentId', authenticateToken, EquipmentSessionsController.getActiveSessionByEquipment);
router.get('/equipment/:equipmentId/history', authenticateToken, EquipmentSessionsController.getSessionHistory);

// POST routes - admin only (for manual login/logout)
router.post('/login', authenticateToken, isAdmin, EquipmentSessionsController.loginEmployee);
router.post('/logout/:equipmentId', authenticateToken, isAdmin, EquipmentSessionsController.logoutEmployee);

export default router;
