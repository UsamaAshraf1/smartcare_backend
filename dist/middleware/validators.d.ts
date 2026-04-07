import { z } from 'zod';
export declare const loginEmailSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const loginOtpRequestSchema: z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export declare const loginOtpVerifySchema: z.ZodObject<{
    phone: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    phone: string;
}, {
    code: string;
    phone: string;
}>;
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    emiratesId: z.ZodOptional<z.ZodString>;
    passportNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    phone?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
}, {
    email: string;
    password: string;
    name: string;
    phone?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
}>, {
    email: string;
    password: string;
    name: string;
    phone?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
}, {
    email: string;
    password: string;
    name: string;
    phone?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
}>;
export declare const createAppointmentSchema: z.ZodObject<{
    doctorId: z.ZodString;
    clinicId: z.ZodString;
    slotId: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    startTime: z.ZodString;
    endTime: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["in_person", "video"]>>;
    category: z.ZodDefault<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "in_person" | "video";
    doctorId: string;
    clinicId: string;
    date: string;
    startTime: string;
    endTime: string;
    category: string;
    slotId?: string | undefined;
    notes?: string | undefined;
}, {
    doctorId: string;
    clinicId: string;
    date: string;
    startTime: string;
    endTime: string;
    type?: "in_person" | "video" | undefined;
    slotId?: string | undefined;
    category?: string | undefined;
    notes?: string | undefined;
}>;
export declare const cancelAppointmentSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export declare const createOrderSchema: z.ZodObject<{
    serviceType: z.ZodEnum<["appointment", "lab_package", "lab_individual", "home_visit", "caregiver", "face_vitals"]>;
    totalAmount: z.ZodNumber;
    details: z.ZodRecord<z.ZodString, z.ZodAny>;
    isHomeCollection: z.ZodOptional<z.ZodBoolean>;
    homeAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    serviceType: "appointment" | "lab_package" | "lab_individual" | "home_visit" | "caregiver" | "face_vitals";
    totalAmount: number;
    details: Record<string, any>;
    isHomeCollection?: boolean | undefined;
    homeAddress?: string | undefined;
}, {
    serviceType: "appointment" | "lab_package" | "lab_individual" | "home_visit" | "caregiver" | "face_vitals";
    totalAmount: number;
    details: Record<string, any>;
    isHomeCollection?: boolean | undefined;
    homeAddress?: string | undefined;
}>;
export declare const processPaymentSchema: z.ZodObject<{
    orderId: z.ZodString;
    paymentMethod: z.ZodEnum<["card", "apple_pay", "uaepass_wallet"]>;
    savedCardId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    paymentMethod: "card" | "apple_pay" | "uaepass_wallet";
    savedCardId?: string | undefined;
}, {
    orderId: string;
    paymentMethod: "card" | "apple_pay" | "uaepass_wallet";
    savedCardId?: string | undefined;
}>;
export declare const createCaregiverJobSchema: z.ZodObject<{
    plan: z.ZodEnum<["hourly", "shift", "monthly"]>;
    startDate: z.ZodString;
    endDate: z.ZodOptional<z.ZodString>;
    hoursPerDay: z.ZodOptional<z.ZodNumber>;
    tasks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    plan: "shift" | "hourly" | "monthly";
    startDate: string;
    tasks: string[];
    endDate?: string | undefined;
    hoursPerDay?: number | undefined;
}, {
    plan: "shift" | "hourly" | "monthly";
    startDate: string;
    endDate?: string | undefined;
    hoursPerDay?: number | undefined;
    tasks?: string[] | undefined;
}>;
export declare const aiAssessmentSchema: z.ZodObject<{
    assessmentType: z.ZodEnum<["emr", "document", "vitals"]>;
    inputData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    assessmentType: "emr" | "document" | "vitals";
    inputData?: Record<string, any> | undefined;
}, {
    assessmentType: "emr" | "document" | "vitals";
    inputData?: Record<string, any> | undefined;
}>;
export declare const updateProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    bloodType: z.ZodOptional<z.ZodString>;
    emergencyContact: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodString;
        relation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        name: string;
        relation: string;
    }, {
        phone: string;
        name: string;
        relation: string;
    }>>;
    emiratesId: z.ZodOptional<z.ZodString>;
    passportNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    name?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: string | undefined;
    bloodType?: string | undefined;
    emergencyContact?: {
        phone: string;
        name: string;
        relation: string;
    } | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    name?: string | undefined;
    emiratesId?: string | undefined;
    passportNumber?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: string | undefined;
    bloodType?: string | undefined;
    emergencyContact?: {
        phone: string;
        name: string;
        relation: string;
    } | undefined;
}>;
export declare const updatePreferencesSchema: z.ZodObject<{
    language: z.ZodOptional<z.ZodString>;
    notifications: z.ZodOptional<z.ZodBoolean>;
    darkMode: z.ZodOptional<z.ZodBoolean>;
    smsAlerts: z.ZodOptional<z.ZodBoolean>;
    emailAlerts: z.ZodOptional<z.ZodBoolean>;
    textSize: z.ZodOptional<z.ZodEnum<["small", "default", "large"]>>;
    appointmentReminders: z.ZodOptional<z.ZodBoolean>;
    labAlerts: z.ZodOptional<z.ZodBoolean>;
    promotionalOffers: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    language?: string | undefined;
    notifications?: boolean | undefined;
    darkMode?: boolean | undefined;
    smsAlerts?: boolean | undefined;
    emailAlerts?: boolean | undefined;
    textSize?: "default" | "small" | "large" | undefined;
    appointmentReminders?: boolean | undefined;
    labAlerts?: boolean | undefined;
    promotionalOffers?: boolean | undefined;
}, {
    language?: string | undefined;
    notifications?: boolean | undefined;
    darkMode?: boolean | undefined;
    smsAlerts?: boolean | undefined;
    emailAlerts?: boolean | undefined;
    textSize?: "default" | "small" | "large" | undefined;
    appointmentReminders?: boolean | undefined;
    labAlerts?: boolean | undefined;
    promotionalOffers?: boolean | undefined;
}>;
//# sourceMappingURL=validators.d.ts.map