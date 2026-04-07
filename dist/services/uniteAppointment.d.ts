/** GET /gateway/getclinics */
export declare function getUniteClinics(): Promise<any>;
/**
 * GET /gateway/getdoctors
 * Docs show no query params; if you need filtering, do it client-side using the `clinics` list on each doctor.
 */
export declare function getUniteDoctors(): Promise<any>;
/**
 * GET /gateway/getavailableslots?clinic_id=...&doctor_id=...&date=dd-MM-yyyy
 * Docs: request date is dd-MM-yyyy; response keys are YYYY-MM-DD.
 */
export declare function getUniteAvailableSlots(clinicId: string, doctorId: string, date: string): Promise<any[]>;
/** POST /gateway/createappointment */
export declare function createUniteAppointment(payload: Record<string, any>): Promise<any>;
/** POST /gateway/createappointmentwithitemdetails */
export declare function createUniteAppointmentWithItems(payload: Record<string, any>): Promise<any>;
/** POST /gateway/updateappointmentstatus */
export declare function updateUniteAppointmentStatus(appointmentId: string | number, appointmentStatus: string, remarks?: string): Promise<any>;
/** POST /gateway/updateappointment */
export declare function updateUniteAppointment(payload: Record<string, any>): Promise<any>;
/** POST /gateway/updateappointmentwithitemdetails */
export declare function updateUniteAppointmentWithItems(payload: Record<string, any>): Promise<any>;
/**
 * GET /gateway/getallappointments?clinic_id=...&from_date=dd-MM-yyyy&to_date=dd-MM-yyyy
 */
export declare function getUniteAppointments(clinicId: string, fromDate: string, toDate: string): Promise<any>;
/** GET /gateway/getitemdetails */
export declare function getUniteItemDetails(): Promise<any>;
/** POST /gateway/createinvoice */
export declare function createUniteInvoice(payload: Record<string, any>): Promise<any>;
//# sourceMappingURL=uniteAppointment.d.ts.map