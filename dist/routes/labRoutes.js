import { Router } from 'express';
import { getLabPackages, getLabTests, getLabCategories } from '../controllers/labController.js';
const router = Router();
router.get('/packages', getLabPackages);
router.get('/tests', getLabTests);
router.get('/categories', getLabCategories);
export default router;
//# sourceMappingURL=labRoutes.js.map