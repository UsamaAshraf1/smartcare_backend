import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { updateProfile, updatePreferences, getNotifications, markNotificationRead, markAllRead, getUnreadCount, getPromotions } from '../controllers/userController.js';
const router = Router();
router.get('/promotions', getPromotions); // Public
router.use(authMiddleware);
router.patch('/profile', updateProfile);
router.patch('/preferences', updatePreferences);
router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllRead);
export default router;
//# sourceMappingURL=userRoutes.js.map