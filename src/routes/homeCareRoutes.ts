import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getHomeVisits, getHomeVisitTracking, getCaregiverPlans, createCaregiverJob, getCaregiverJobs } from '../controllers/homeCareController.js';

const router = Router();

router.get('/caregiver-plans', getCaregiverPlans); // Public

router.use(authMiddleware);

router.get('/visits', getHomeVisits);
router.get('/visits/:orderId/tracking', getHomeVisitTracking);
router.get('/caregiver-jobs', getCaregiverJobs);
router.post('/caregiver-jobs', createCaregiverJob);

export default router;
