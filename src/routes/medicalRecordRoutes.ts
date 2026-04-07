import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getMedicalRecords,
  getMedications,
  getAllergies,
  getDiagnoses,
  getVitals,
  getLabResults,
  syncFaceVitalsRecord,
  syncUniteRecords,
} from '../controllers/medicalRecordController.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getMedicalRecords);
router.get('/medications', getMedications);
router.get('/allergies', getAllergies);
router.get('/diagnoses', getDiagnoses);
router.get('/vitals', getVitals);
router.get('/lab-results', getLabResults);
router.post('/vitals/sync-face', syncFaceVitalsRecord);
router.post('/sync/unite', syncUniteRecords);

export default router;
