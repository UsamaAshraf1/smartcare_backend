import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getClinics,
  getDoctors,
  getAvailableSlots,
  createAppointment,
  getAppointments,
  syncStatuses,
} from '../controllers/uniteAppointmentController.js';

const router = Router();

router.use(authMiddleware);

router.get('/clinics', getClinics);
router.get('/doctors', getDoctors);
router.get('/slots', getAvailableSlots);
router.get('/appointments', getAppointments);
router.post('/appointments', createAppointment);
router.post('/sync-statuses', syncStatuses);

export default router;

