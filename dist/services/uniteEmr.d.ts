/**
 * Fetch medical records for a date range (max 30 days).
 * POST /gateway/GetMedicalRecordsDetails
 * Body: { from_date: "dd-MM-yyyy", to_date: "dd-MM-yyyy" }
 *
 * Returns patient data with allergies, visit details (vitals, diagnosis, medication, items, notes)
 */
export declare function getMedicalRecords(fromDate: string, toDate: string): Promise<any>;
export interface TransformedPatient {
    patientPin: string;
    name: string;
    phone: string;
    email: string;
    gender: string;
    nationality: string;
    dateOfBirth: string;
    city: string;
    emiratesId: string;
    emiratesIdType: string;
    allergies: TransformedAllergy[];
    visits: TransformedVisit[];
}
export interface TransformedAllergy {
    type: string;
    severity: string;
    notes: string;
    reaction: string;
    recordedAt: string;
}
export interface TransformedVisit {
    date: string;
    doctor: string;
    createdBy: string;
    clinic: string;
    department: string;
    isFollowUp: boolean;
    vitals: Record<string, string>[];
    diagnoses: {
        type: string;
        code: string;
        description: string;
    }[];
    medications: {
        code: string;
        name: string;
        dosageDays: string;
        quantity: string;
        instructions: string;
    }[];
    items: Record<string, {
        code: string;
        description: string;
    }[]>;
    notes: Record<string, string>;
}
/**
 * Transform raw Unite EMR patient data into our app's format
 */
export declare function transformPatientData(rawPatient: any): TransformedPatient;
/**
 * Helper: Get date string in dd-MM-yyyy format (Unite EMR format)
 */
export declare function formatDateForUnite(date: Date): string;
/**
 * Convenience: Fetch records for the last N days
 */
export declare function getRecentRecords(days?: number): Promise<any>;
declare const _default: {
    getMedicalRecords: typeof getMedicalRecords;
    getRecentRecords: typeof getRecentRecords;
    transformPatientData: typeof transformPatientData;
    formatDateForUnite: typeof formatDateForUnite;
};
export default _default;
//# sourceMappingURL=uniteEmr.d.ts.map