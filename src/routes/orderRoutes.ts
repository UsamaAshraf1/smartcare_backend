import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createOrder, getOrders, getOrderById, processPayment, cancelOrder } from '../controllers/orderController.js';

const router = Router();

router.use(authMiddleware);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/pay', processPayment);
router.patch('/:id/cancel', cancelOrder);

export default router;
