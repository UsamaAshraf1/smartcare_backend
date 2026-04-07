import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────

export const loginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginOtpRequestSchema = z.object({
  phone: z.string().regex(/^\+971\s?\d{2}\s?\d{3}\s?\d{4}$/, 'Invalid UAE phone number'),
});

export const loginOtpVerifySchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  emiratesId: z.string().optional(),
  passportNumber: z.string().optional(),
}).refine(
  (data) => data.emiratesId || data.passportNumber,
  { message: 'Either Emirates ID or passport number is required', path: ['emiratesId'] }
);

// ─── Appointments ────────────────────────────────────────

export const createAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  clinicId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  date: z.string(), // ISO date
  startTime: z.string(), // HH:MM
  endTime: z.string(),
  type: z.enum(['in_person', 'video']).default('in_person'),
  category: z.string().default('Consultation'),
  notes: z.string().optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().optional(),
});

// ─── Orders ──────────────────────────────────────────────

export const createOrderSchema = z.object({
  serviceType: z.enum(['appointment', 'lab_package', 'lab_individual', 'home_visit', 'caregiver', 'face_vitals']),
  totalAmount: z.number().positive(),
  details: z.record(z.any()),
  isHomeCollection: z.boolean().optional(),
  homeAddress: z.string().optional(),
});

// ─── Payments ────────────────────────────────────────────

export const processPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(['card', 'apple_pay', 'uaepass_wallet']),
  savedCardId: z.string().uuid().optional(),
});

// ─── Caregiver ───────────────────────────────────────────

export const createCaregiverJobSchema = z.object({
  plan: z.enum(['hourly', 'shift', 'monthly']),
  startDate: z.string(),
  endDate: z.string().optional(),
  hoursPerDay: z.number().optional(),
  tasks: z.array(z.string()).default([]),
});

// ─── AI Assessment ───────────────────────────────────────

export const aiAssessmentSchema = z.object({
  assessmentType: z.enum(['emr', 'document', 'vitals']),
  inputData: z.record(z.any()).optional(),
});

// ─── Profile Update ──────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  bloodType: z.string().optional(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relation: z.string(),
  }).optional(),
  emiratesId: z.string().optional(),
  passportNumber: z.string().optional(),
});

export const updatePreferencesSchema = z.object({
  language: z.string().optional(),
  notifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  smsAlerts: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
  textSize: z.enum(['small', 'default', 'large']).optional(),
  appointmentReminders: z.boolean().optional(),
  labAlerts: z.boolean().optional(),
  promotionalOffers: z.boolean().optional(),
});
