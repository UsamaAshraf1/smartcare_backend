import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getTokenBalance, getScanLink, pollScanResults, getFaceScan, listFaceScans, getFaceScanResults, listBusinessVitalsLinks, getBusinessVitalsLink, listBusinessVitalsScans, getBusinessVitalsScan, listBusinessVitalsTemplates, getBusinessVitalsTemplate, } from '../controllers/faceVitalsController.js';
const router = Router();
router.use(authenticate);
router.get('/facevitals/tokens', getTokenBalance);
router.get('/facevitals/scan-link', getScanLink);
router.get('/facevitals/scans/poll', pollScanResults);
router.get('/facevitals/scans', listFaceScans);
router.get('/facevitals/scans/:scanId', getFaceScan);
router.get('/facevitals/scans/:scanId/results', getFaceScanResults);
router.get('/businesses/:businessId/vitals/links', listBusinessVitalsLinks);
router.get('/businesses/:businessId/vitals/links/:id', getBusinessVitalsLink);
router.get('/businesses/:businessId/vitals/scans', listBusinessVitalsScans);
router.get('/businesses/:businessId/vitals/scans/:id', getBusinessVitalsScan);
router.get('/businesses/:businessId/vitals/templates', listBusinessVitalsTemplates);
router.get('/businesses/:businessId/vitals/templates/:id', getBusinessVitalsTemplate);
export default router;
//# sourceMappingURL=faceVitalsRoutes.js.map