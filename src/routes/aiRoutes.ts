import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { runEMRAssessment, runDocumentAnalysis, runVitalsAssessment, getAssessmentHistory, getAssessmentById } from '../controllers/aiController.js';

const router = Router();

router.use(authMiddleware);

router.post('/emr-assessment', runEMRAssessment);
router.post('/document-analysis', runDocumentAnalysis);
router.post('/vitals-assessment', runVitalsAssessment);
router.get('/history', getAssessmentHistory);
router.get('/:id', getAssessmentById);

export default router;
