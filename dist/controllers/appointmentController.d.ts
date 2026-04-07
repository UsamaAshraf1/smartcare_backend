import { Request, Response, NextFunction } from 'express';
export declare function getAppointments(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAppointmentById(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function createAppointment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function rescheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getPastVisits(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadPastVisitSummaryPdf(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=appointmentController.d.ts.map