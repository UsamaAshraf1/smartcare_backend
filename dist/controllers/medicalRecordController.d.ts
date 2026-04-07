import { Request, Response, NextFunction } from 'express';
export declare function getMedicalRecords(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMedications(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAllergies(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDiagnoses(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getVitals(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getLabResults(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function syncFaceVitalsRecord(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function syncUniteRecords(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=medicalRecordController.d.ts.map