import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getAppointments, getAppointmentById, createAppointment,
  cancelAppointment, rescheduleAppointment, getPastVisits, downloadPastVisitSummaryPdf
} from '../controllers/appointmentController.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getAppointments);
router.get('/past', getPastVisits);
router.get('/past/:id/summary-pdf', downloadPastVisitSummaryPdf);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/reschedule', rescheduleAppointment);

export default router;
