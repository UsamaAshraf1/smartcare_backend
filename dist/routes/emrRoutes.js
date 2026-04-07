import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getEmrRecords, getEmrPatientRecords, getEmrAllergies, getEmrVisits, getEmrMedications, getEmrVitals, getEmrDiagnoses, } from '../controllers/emrController.js';
const router = Router();
// All EMR routes require authentication
router.use(authenticate);
router.get('/records', getEmrRecords);
router.get('/records/patient/:patientPin', getEmrPatientRecords);
router.get('/allergies/:patientPin', getEmrAllergies);
router.get('/visits/:patientPin', getEmrVisits);
router.get('/medications/:patientPin', getEmrMedications);
router.get('/vitals/:patientPin', getEmrVitals);
router.get('/diagnoses/:patientPin', getEmrDiagnoses);
export default router;
//# sourceMappingURL=emrRoutes.js.map