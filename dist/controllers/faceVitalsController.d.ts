import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/facevitals/tokens
 * Return the user's remaining face vitals token balance
 */
export declare function getTokenBalance(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/facevitals/scan-link
 * Returns the URL of an active VitalsLink for the user to open and perform a scan.
 * Also deducts 1 token from the user's balance.
 */
export declare function getScanLink(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/facevitals/scans/poll
 * Poll for the latest completed scan for a given vitalsLinkId.
 * Query params: ?linkId=xxx
 * Returns the most recent SUCCEEDED scan, or a pending status.
 */
export declare function pollScanResults(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/facevitals/scans/:scanId
 * Get scan details and results
 */
export declare function getFaceScan(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/facevitals/scans
 * List all scans
 */
export declare function listFaceScans(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/facevitals/scans/:scanId/results
 * Get only the formatted results of a completed scan
 */
export declare function getFaceScanResults(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/links
 */
export declare function listBusinessVitalsLinks(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/links/:id
 */
export declare function getBusinessVitalsLink(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/scans
 */
export declare function listBusinessVitalsScans(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/scans/:id
 */
export declare function getBusinessVitalsScan(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/templates
 */
export declare function listBusinessVitalsTemplates(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/businesses/:businessId/vitals/templates/:id
 */
export declare function getBusinessVitalsTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=faceVitalsController.d.ts.map