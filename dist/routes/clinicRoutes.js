import { Router } from 'express';
import { getClinics, getClinicById, getDoctors, getDoctorById, getDoctorSlots, getSpecialties } from '../controllers/clinicController.js';
const router = Router();
// Public routes (no auth needed for browsing)
router.get('/clinics', getClinics);
router.get('/clinics/:id', getClinicById);
router.get('/doctors', getDoctors);
router.get('/doctors/:id', getDoctorById);
router.get('/doctors/:id/slots', getDoctorSlots);
router.get('/specialties', getSpecialties);
export default router;
//# sourceMappingURL=clinicRoutes.js.map