import { Router } from 'express';
import { FaceRecognitionController } from '../controllers/face-recognition.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Grupos
router.get('/groups', authenticateToken, FaceRecognitionController.listGroups);

// Pessoas
router.get('/persons', authenticateToken, FaceRecognitionController.listPersons);
router.post('/persons', authenticateToken, FaceRecognitionController.addPerson);
router.delete('/persons/:uid', authenticateToken, FaceRecognitionController.deletePerson);

// Eventos de detecção facial
router.get('/events', authenticateToken, FaceRecognitionController.searchEvents);

// Snapshot
router.get('/snapshot', authenticateToken, FaceRecognitionController.getSnapshot);

export default router;
