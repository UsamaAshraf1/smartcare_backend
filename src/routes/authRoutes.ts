import { Router } from 'express';
import { register, loginEmail, requestOtp, verifyOtp, loginUaePass, uaePassCallback, getMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login/email', loginEmail);
router.post('/login/otp/request', requestOtp);
router.post('/login/otp/verify', verifyOtp);
router.get('/login/uaepass', loginUaePass);
router.get('/uaepass/callback', uaePassCallback);
router.get('/me', authMiddleware, getMe);

export default router;
