import { Request, Response } from 'express';
export declare function getClinics(_req: Request, res: Response): Promise<void>;
export declare function getDoctors(req: Request, res: Response): Promise<void>;
export declare function getAvailableSlots(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createAppointment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getAppointments(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Sync Unite EMR appointment statuses, dates, and times into local mappings.
 * This is the core function that resolves the "changes made in Unite EMR don't
 * reflect in the app" problem. It:
 *
 * 1. Fetches all non-cancelled local mappings for the patient
 * 2. Groups them by clinic and queries Unite's getallappointments
 * 3. Matches Unite records to local mappings by appointmentid, appointmentno,
 *    date+time slot, phone+doctor, etc.
 * 4. Updates status, date, start_time, end_time when they differ
 * 5. Cross-clinic recovery: if appointment moved clinics in Unite
 * 6. Inferred cancellation: if appointment not found anywhere in Unite
 */
export declare function syncUniteAppointmentStatusesForPatient(patientId: string): Promise<number>;
export declare function syncStatuses(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=uniteAppointmentController.d.ts.map