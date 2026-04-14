// ═══════════════════════════════════════════════════════════
// SMART CARE POLYCLINIC — Database Schema (Drizzle ORM)
// ═══════════════════════════════════════════════════════════
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, date, time } from 'drizzle-orm/pg-core';
// ─── Enums ───────────────────────────────────────────────
export const authMethodEnum = pgEnum('auth_method', ['uaepass', 'otp', 'email']);
export const orderStatusEnum = pgEnum('order_status', [
    'pending_payment', 'confirmed', 'assigned', 'en_route',
    'in_progress', 'completed', 'cancelled'
]);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'refunded']);
export const paymentMethodEnum = pgEnum('payment_method', ['card', 'apple_pay', 'uaepass_wallet']);
export const serviceTypeEnum = pgEnum('service_type', [
    'appointment', 'lab_package', 'lab_individual', 'home_visit', 'caregiver', 'face_vitals'
]);
export const caregiverPlanEnum = pgEnum('caregiver_plan', ['hourly', 'shift', 'monthly']);
export const appointmentTypeEnum = pgEnum('appointment_type', ['in_person', 'video']);
export const userRoleEnum = pgEnum('user_role', ['patient', 'doctor', 'nurse', 'caregiver', 'admin']);
export const notificationTypeEnum = pgEnum('notification_type', [
    'appointment_reminder', 'lab_result', 'order_update', 'promotion', 'system'
]);
// ─── Users / Patients ────────────────────────────────────
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    emiratesId: varchar('emirates_id', { length: 20 }).unique(),
    uaePassToken: text('uae_pass_token'),
    emrId: varchar('emr_id', { length: 30 }).unique(),
    passportNumber: varchar('passport_number', { length: 30 }).unique(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    phone: varchar('phone', { length: 20 }),
    passwordHash: text('password_hash'),
    photoUrl: text('photo_url'),
    role: userRoleEnum('role').default('patient').notNull(),
    authMethod: authMethodEnum('auth_method').default('email'),
    dateOfBirth: date('date_of_birth'),
    gender: varchar('gender', { length: 10 }),
    bloodType: varchar('blood_type', { length: 5 }),
    emergencyContact: jsonb('emergency_contact').$type(),
    preferences: jsonb('preferences').$type(),
    faceVitalsTokens: integer('face_vitals_tokens').default(5).notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    isActive: boolean('is_active').default(true),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── Saved Payment Methods ──────────────────────────────
export const savedPaymentMethods = pgTable('saved_payment_methods', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    stripePmId: varchar('stripe_pm_id', { length: 255 }).notNull(),
    brand: varchar('brand', { length: 30 }).notNull(),
    last4: varchar('last4', { length: 4 }).notNull(),
    expMonth: integer('exp_month').notNull(),
    expYear: integer('exp_year').notNull(),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── Clinics ─────────────────────────────────────────────
export const clinics = pgTable('clinics', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    location: varchar('location', { length: 300 }).notNull(),
    address: text('address'),
    type: varchar('type', { length: 50 }).notNull(), // 'Primary Facility' | 'B2B Integrated'
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    operatingHours: jsonb('operating_hours').$type(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── Doctors ─────────────────────────────────────────────
export const doctors = pgTable('doctors', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    clinicId: uuid('clinic_id').references(() => clinics.id).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    specialty: varchar('specialty', { length: 100 }).notNull(),
    qualifications: text('qualifications'),
    rating: decimal('rating', { precision: 2, scale: 1 }).default('0'),
    reviewCount: integer('review_count').default(0),
    consultationPrice: integer('consultation_price').notNull(),
    videoPrice: integer('video_price'),
    photoUrl: text('photo_url'),
    bio: text('bio'),
    languages: jsonb('languages').$type().default([]),
    isAvailable: boolean('is_available').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── Doctor Availability / Slots ─────────────────────────
export const doctorSlots = pgTable('doctor_slots', {
    id: uuid('id').defaultRandom().primaryKey(),
    doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
    clinicId: uuid('clinic_id').references(() => clinics.id).notNull(),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    isBooked: boolean('is_booked').default(false),
    isBlocked: boolean('is_blocked').default(false),
    appointmentType: appointmentTypeEnum('appointment_type').default('in_person'),
});
// ─── Appointments ────────────────────────────────────────
export const appointments = pgTable('appointments', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
    clinicId: uuid('clinic_id').references(() => clinics.id).notNull(),
    slotId: uuid('slot_id').references(() => doctorSlots.id),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    type: appointmentTypeEnum('type').default('in_person'),
    category: varchar('category', { length: 100 }).default('Consultation'),
    status: orderStatusEnum('status').default('pending_payment').notNull(),
    notes: text('notes'),
    cancellationReason: text('cancellation_reason'),
    reminderSent: boolean('reminder_sent').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── Unite Appointment Mappings ──────────────────────────
export const uniteAppointmentMappings = pgTable('unite_appointment_mappings', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    localAppointmentId: uuid('local_appointment_id').references(() => appointments.id),
    uniteAppointmentId: varchar('unite_appointment_id', { length: 100 }),
    clinicId: varchar('clinic_id', { length: 100 }).notNull(),
    doctorId: varchar('doctor_id', { length: 100 }).notNull(),
    date: date('date').notNull(),
    startTime: varchar('start_time', { length: 20 }).notNull(),
    endTime: varchar('end_time', { length: 20 }),
    patientIdentifierUsed: varchar('patient_identifier_used', { length: 255 }).notNull(),
    identifierType: varchar('identifier_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 50 }).default('confirmed'),
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── Medical Records ─────────────────────────────────────
export const medicalRecords = pgTable('medical_records', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    recordType: varchar('record_type', { length: 50 }).notNull(), // 'medication' | 'allergy' | 'diagnosis' | 'vital' | 'lab_result'
    title: varchar('title', { length: 200 }).notNull(),
    data: jsonb('data').notNull(), // Flexible JSON for different record types
    isActive: boolean('is_active').default(true),
    recordedBy: uuid('recorded_by').references(() => users.id),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── Lab Packages & Tests ────────────────────────────────
export const labPackages = pgTable('lab_packages', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    price: integer('price').notNull(),
    tests: jsonb('tests').$type().notNull(),
    color: varchar('color', { length: 30 }),
    isPopular: boolean('is_popular').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const labTests = pgTable('lab_tests', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    price: integer('price').notNull(),
    category: varchar('category', { length: 100 }),
    description: text('description'),
    turnaroundHours: integer('turnaround_hours').default(24),
    isActive: boolean('is_active').default(true),
});
// ─── Service Orders (unified) ────────────────────────────
export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    serviceType: serviceTypeEnum('service_type').notNull(),
    status: orderStatusEnum('status').default('pending_payment').notNull(),
    totalAmount: integer('total_amount').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
    paymentMethod: paymentMethodEnum('payment_method'),
    stripePaymentId: varchar('stripe_payment_id', { length: 255 }),
    details: jsonb('details').notNull(), // Type-specific metadata
    isHomeCollection: boolean('is_home_collection').default(false),
    homeAddress: text('home_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── Caregiver Jobs ──────────────────────────────────────
export const caregiverJobs = pgTable('caregiver_jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    caregiverId: uuid('caregiver_id').references(() => users.id),
    plan: caregiverPlanEnum('plan').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    hoursPerDay: integer('hours_per_day'),
    tasks: jsonb('tasks').$type().default([]),
    status: orderStatusEnum('status').default('pending_payment').notNull(),
    rating: decimal('rating', { precision: 2, scale: 1 }),
    review: text('review'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── Home Visit Tracking ─────────────────────────────────
export const homeVisitTracking = pgTable('home_visit_tracking', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    clinicianId: uuid('clinician_id').references(() => users.id),
    clinicianName: varchar('clinician_name', { length: 200 }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    bearing: decimal('bearing', { precision: 5, scale: 2 }),
    status: orderStatusEnum('status').default('assigned').notNull(),
    estimatedArrival: timestamp('estimated_arrival'),
    arrivedAt: timestamp('arrived_at'),
    completedAt: timestamp('completed_at'),
    notes: text('notes'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// ─── AI Health Assessments ───────────────────────────────
export const aiAssessments = pgTable('ai_assessments', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => users.id).notNull(),
    assessmentType: varchar('assessment_type', { length: 50 }).notNull(), // 'emr' | 'document' | 'vitals'
    inputData: jsonb('input_data'),
    result: text('result').notNull(),
    model: varchar('model', { length: 100 }).default('gemini-2.0-flash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// ─── Notifications ───────────────────────────────────────
export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    isRead: boolean('is_read').default(false),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
});
// ─── Promotions / Offers ─────────────────────────────────
export const promotions = pgTable('promotions', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    clinicId: uuid('clinic_id').references(() => clinics.id),
    discountPercent: integer('discount_percent'),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
//# sourceMappingURL=schema.js.map