import { Request, Response, NextFunction } from 'express';
export declare function runEMRAssessment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function runDocumentAnalysis(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function runVitalsAssessment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAssessmentHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAssessmentById(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=aiController.d.ts.map