/**
 * appointmentUtils.ts
 * Shared utility functions for appointment controllers.
 * Eliminates duplication between appointmentController and uniteAppointmentController.
 */
/** Extract YYYY-MM-DD from any date-like string (ISO, DD-MM-YYYY, datetime). */
export declare function toIsoDate(value: any): string;
/** Convert to DD-MM-YYYY for Unite API calls. */
export declare function toDdMmYyyy(input: string): string;
/** Shift an ISO date string by N days. */
export declare function shiftIsoDate(isoDate: string, days: number): string;
/** Normalize any time string to HH:mm (24h). Handles "HH:mm", "H:mm:ss", "hh:mm AM/PM". */
export declare function toHhMm24(input: any): string;
/** Compute difference in minutes between two HH:mm strings. Returns 15 as default. */
export declare function minutesDiff(start: string, end: string): number;
/** Add minutes to an HH:mm string, wrapping at midnight. */
export declare function addMinutesToHhMm(startTime: string, minutesToAdd: number): string;
/** Format phone for Unite API: "971-XXXXXXX". */
export declare function formatPhoneForUnite(input?: string | null): string;
/** Normalize phone to local digits only (strip country code) for matching. */
export declare function normalizePhoneDigits(input?: string | null): string;
/**
 * Normalize Unite / local appointment status codes to a consistent lowercase value.
 * Unite codes: AAC, ACF, APH, YTC → confirmed; CVI → cancelled; NSW → no_show
 */
export declare function normalizeAppointmentStatus(value: any): string;
/** Case-insensitive field lookup on an object. */
export declare function getFieldCI(obj: any, keys: string[]): any;
/** Extract appointmentid + appointmentno from Unite response/raw data. */
export declare function extractUniteAppointmentRefs(payload: any): {
    appointmentid: string | null;
    appointmentno: string | null;
};
/** Get the primary appointmentid from a Unite response. */
export declare function extractUniteAppointmentId(payload: any): string | null;
/** Extract appointment status code from a Unite response. */
export declare function extractUniteStatusCode(payload: any): string;
/** Convert a raw Unite appointment ID to number (if purely numeric) or string. */
export declare function toUniteIdValue(input: string | number): string | number;
/**
 * Parse date, startTime, endTime from a Unite appointment object.
 * Handles various field naming conventions across Unite API versions.
 */
export declare function extractUniteStartDateTimeParts(ua: any): {
    date?: string;
    startTime?: string;
    endTime?: string;
};
export declare function splitName(fullName: string): {
    firstName: string;
    middleName: string;
    lastName: string;
};
/** Convert gender string to Unite single-char code. */
export declare function toUniteGenderCode(gender?: string): string;
/** Determine photo type for Unite based on identifier type. */
export declare function toUnitePhotoType(identifierType: string): string | undefined;
export declare function slotKey(date?: string, startTime?: string, doctorId?: string): string;
/** Extract an array from various Unite response shapes. */
export declare function toUniteArray(data: any): any[];
/** Extract and normalize phone from a Unite appointment record. */
export declare function extractUnitePhone(ua: any): string;
/** Extract doctor_id from a Unite appointment record. */
export declare function extractUniteDoctorId(ua: any): string;
/** Extract Unite appointment status from a raw record. */
export declare function extractUniteRecordStatus(ua: any): string;
//# sourceMappingURL=appointmentUtils.d.ts.map