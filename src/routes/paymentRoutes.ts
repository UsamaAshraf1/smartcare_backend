import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  createSetupIntent,
  listPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  setDefaultMethod,
} from '../controllers/paymentController.js';

const router = Router();

router.use(authMiddleware);

router.post('/setup-intent', createSetupIntent);
router.get('/methods', listPaymentMethods);
router.post('/methods', savePaymentMethod);
router.delete('/methods/:id', deletePaymentMethod);
router.post('/methods/:id/default', setDefaultMethod);

export default router;
