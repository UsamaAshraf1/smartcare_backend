import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/emr/records?from=dd-MM-yyyy&to=dd-MM-yyyy
 * Fetch medical records from Unite EMR for a date range
 */
export declare function getEmrRecords(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/emr/records/patient/:patientPin
 * Fetch records for a specific patient from Unite EMR
 */
export declare function getEmrPatientRecords(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/emr/allergies/:patientPin
 * Get allergies for a specific patient
 */
export declare function getEmrAllergies(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/emr/visits/:patientPin
 * Get visit history for a specific patient
 */
export declare function getEmrVisits(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/emr/medications/:patientPin
 * Get all medications across visits for a patient
 */
export declare function getEmrMedications(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/emr/vitals/:patientPin
 * Get all vitals across visits for a patient
 */
export declare function getEmrVitals(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/emr/diagnoses/:patientPin
 * Get all diagnoses across visits for a patient
 */
export declare function getEmrDiagnoses(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=emrController.d.ts.map