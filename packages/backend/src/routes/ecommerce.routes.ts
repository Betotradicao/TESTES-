import { Router } from 'express';
import { EcommerceController } from '../controllers/ecommerce.controller';

const router = Router();

// GET /api/ecommerce/buscar?q=oleo+de+soja&fonte=mercadolivre
router.get('/buscar', EcommerceController.buscar);

export default router;
