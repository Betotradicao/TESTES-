import { Router } from 'express';
import { BankAccountsController } from '../controllers/bank-accounts.controller';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';

const router: Router = Router();

// Multer para upload de certificado PFX
const certUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pfx', '.p12', '.pem', '.key', '.cer', '.crt'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de certificado são permitidos (.pfx, .p12, .pem, .key, .cer, .crt)'));
    }
  }
});

// CRUD
router.get('/', authenticateToken, BankAccountsController.getAll);
router.get('/:id', authenticateToken, BankAccountsController.getById);
router.post('/', authenticateToken, BankAccountsController.create);
router.put('/:id', authenticateToken, BankAccountsController.update);
router.delete('/:id', authenticateToken, BankAccountsController.delete);

// Upload de certificado
router.post('/:id/certificate', authenticateToken, certUpload.single('certificate'), BankAccountsController.uploadCertificate);

// Testar conexão
router.post('/:id/test', authenticateToken, BankAccountsController.testConnection);

export default router;
