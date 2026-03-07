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

// Detecções faciais do dia (via NetSDK)
router.get('/detections', authenticateToken, FaceRecognitionController.searchDetections);

// Eventos de detecção facial (legacy)
router.get('/events', authenticateToken, FaceRecognitionController.searchEvents);

// Foto de pessoa (proxy do DVR)
router.get('/person-photo', authenticateToken, FaceRecognitionController.getPersonPhoto);

// Imagem de deteccao facial (proxy do DVR)
router.get('/detection-image', authenticateToken, FaceRecognitionController.getDetectionImage);

// Snapshot
router.get('/snapshot', authenticateToken, FaceRecognitionController.getSnapshot);

export default router;
