// ═══════════════════════════════════════════════════════════
// Database Migration — Creates all tables from schema
// Run: npm run migrate
// ═══════════════════════════════════════════════════════════
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const sql = `
-- Enums
DO $$ BEGIN
  CREATE TYPE auth_method AS ENUM ('uaepass', 'otp', 'email');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending_payment', 'confirmed', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('card', 'apple_pay', 'uaepass_wallet');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('appointment', 'lab_package', 'lab_individual', 'home_visit', 'caregiver');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE caregiver_plan AS ENUM ('hourly', 'shift', 'monthly');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE appointment_type AS ENUM ('in_person', 'video');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'nurse', 'caregiver', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('appointment_reminder', 'lab_result', 'order_update', 'promotion', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emirates_id VARCHAR(20) UNIQUE,
  uae_pass_token TEXT,
  emr_id VARCHAR(30) UNIQUE,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password_hash TEXT,
  photo_url TEXT,
  role user_role NOT NULL DEFAULT 'patient',
  auth_method auth_method DEFAULT 'email',
  date_of_birth DATE,
  gender VARCHAR(10),
  blood_type VARCHAR(5),
  emergency_contact JSONB,
  preferences JSONB DEFAULT '{"language":"en","notifications":true,"darkMode":false,"smsAlerts":true,"emailAlerts":true}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add passport_number to users (safe for re-runs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number VARCHAR(30) UNIQUE;

-- Clinics
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  location VARCHAR(300) NOT NULL,
  address TEXT,
  type VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  operating_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(200) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  qualifications TEXT,
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  consultation_price INTEGER NOT NULL,
  video_price INTEGER,
  photo_url TEXT,
  bio TEXT,
  languages JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor Slots
CREATE TABLE IF NOT EXISTS doctor_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  appointment_type appointment_type DEFAULT 'in_person'
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  slot_id UUID REFERENCES doctor_slots(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type appointment_type DEFAULT 'in_person',
  category VARCHAR(100) DEFAULT 'Consultation',
  status order_status NOT NULL DEFAULT 'pending_payment',
  notes TEXT,
  cancellation_reason TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unite Appointment Mappings
CREATE TABLE IF NOT EXISTS unite_appointment_mappings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               UUID NOT NULL REFERENCES users(id),
  local_appointment_id     UUID REFERENCES appointments(id),
  unite_appointment_id     VARCHAR(100),
  clinic_id                VARCHAR(100) NOT NULL,
  doctor_id                VARCHAR(100) NOT NULL,
  date                     DATE NOT NULL,
  start_time               VARCHAR(20) NOT NULL,
  end_time                 VARCHAR(20),
  patient_identifier_used  VARCHAR(255) NOT NULL,
  identifier_type          VARCHAR(20) NOT NULL,
  status                   VARCHAR(50) DEFAULT 'confirmed',
  raw_response             JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Face vitals tokens + Stripe customer ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_vitals_tokens INTEGER NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Saved payment methods (Stripe)
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  stripe_pm_id    VARCHAR(255) NOT NULL,
  brand           VARCHAR(30) NOT NULL,
  last4           VARCHAR(4) NOT NULL,
  exp_month       INTEGER NOT NULL,
  exp_year        INTEGER NOT NULL,
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_pm_user ON saved_payment_methods(user_id);

-- Extend service_type enum for face vitals token packs
DO $$ BEGIN
  ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'face_vitals';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Medical Records
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id),
  record_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lab Packages
CREATE TABLE IF NOT EXISTS lab_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  tests JSONB NOT NULL,
  color VARCHAR(30),
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lab Tests
CREATE TABLE IF NOT EXISTS lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  price INTEGER NOT NULL,
  category VARCHAR(100),
  description TEXT,
  turnaround_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id),
  service_type service_type NOT NULL,
  status order_status NOT NULL DEFAULT 'pending_payment',
  total_amount INTEGER NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  payment_method payment_method,
  stripe_payment_id VARCHAR(255),
  details JSONB NOT NULL,
  is_home_collection BOOLEAN DEFAULT false,
  home_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Caregiver Jobs
CREATE TABLE IF NOT EXISTS caregiver_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  caregiver_id UUID REFERENCES users(id),
  plan caregiver_plan NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  hours_per_day INTEGER,
  tasks JSONB DEFAULT '[]',
  status order_status NOT NULL DEFAULT 'pending_payment',
  rating DECIMAL(2,1),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Home Visit Tracking
CREATE TABLE IF NOT EXISTS home_visit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  clinician_id UUID REFERENCES users(id),
  clinician_name VARCHAR(200),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  bearing DECIMAL(5,2),
  status order_status NOT NULL DEFAULT 'assigned',
  estimated_arrival TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Assessments
CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id),
  assessment_type VARCHAR(50) NOT NULL,
  input_data JSONB,
  result TEXT NOT NULL,
  model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type notification_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT,
  clinic_id UUID REFERENCES clinics(id),
  discount_percent INTEGER,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_doctor_slots_doctor_date ON doctor_slots(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_unite_mappings_patient ON unite_appointment_mappings(patient_id);
CREATE INDEX IF NOT EXISTS idx_unite_mappings_unite_id ON unite_appointment_mappings(unite_appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_home_visit_order ON home_visit_tracking(order_id);

SELECT 'Migration completed successfully!' as status;
`;
async function migrate() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log('🔄 Running migrations...');
        await pool.query(sql);
        console.log('✅ All tables created successfully');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
migrate();
//# sourceMappingURL=migrate.js.map