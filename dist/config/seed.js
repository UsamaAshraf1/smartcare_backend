import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
dotenv.config();
async function seed() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log('🌱 Seeding database...');
        const passwordHash = await bcrypt.hash('demo123', 12);
        // ─── Clinics ───
        await pool.query(`
      INSERT INTO clinics (id, name, location, address, type, phone, latitude, longitude, operating_hours)
      VALUES
        ('a1000000-0000-0000-0000-000000000001', 'Smart Care Clinic', 'Deira', 'MAl Maktoum Road', 'Primary Facility', '+971 4 123 4567', 25.1850000, 55.2708000, '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"10:00","close":"20:00"},"sat":{"open":"09:00","close":"18:00"},"sun":{"open":"09:00","close":"18:00"}}'),
        ('a1000000-0000-0000-0000-000000000002', 'Partner Clinic A', 'Jumeirah', 'Jumeirah Beach Road, Jumeirah 1, Dubai', 'B2B Integrated', '+971 4 234 5678', 25.2330000, 55.2530000, '{"mon":{"open":"09:00","close":"21:00"},"tue":{"open":"09:00","close":"21:00"},"wed":{"open":"09:00","close":"21:00"},"thu":{"open":"09:00","close":"21:00"},"fri":{"open":"10:00","close":"18:00"}}'),
        ('a1000000-0000-0000-0000-000000000003', 'Partner Clinic B', 'Deira', 'Al Rigga Road, Deira, Dubai', 'B2B Integrated', '+971 4 345 6789', 25.2660000, 55.3200000, '{"mon":{"open":"08:00","close":"20:00"},"tue":{"open":"08:00","close":"20:00"},"wed":{"open":"08:00","close":"20:00"},"thu":{"open":"08:00","close":"20:00"}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        location = EXCLUDED.location,
        address = EXCLUDED.address,
        type = EXCLUDED.type,
        phone = EXCLUDED.phone,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        operating_hours = EXCLUDED.operating_hours,
        is_active = true;
    `);
        // ─── Demo Patient ───
        await pool.query(`
      INSERT INTO users (id, emirates_id, emr_id, name, email, phone, password_hash, role, auth_method, date_of_birth, gender, blood_type, emergency_contact, preferences)
      VALUES (
        'b1000000-0000-0000-0000-000000000001',
        '784-1992-1234567-1',
        'SC-DXB-9921',
        'Shamas',
        'shamas@uaepass.ae',
        '+971 50 123 4567',
        '${passwordHash}',
        'patient',
        'uaepass',
        '1992-03-15',
        'male',
        'O+',
        '{"name":"Fatima Mansoor","phone":"+971 50 987 6543","relation":"Spouse"}',
        '{"language":"en","notifications":true,"darkMode":false,"smsAlerts":true,"emailAlerts":true}'
      ) ON CONFLICT (id) DO UPDATE SET
        emirates_id = EXCLUDED.emirates_id,
        emr_id = EXCLUDED.emr_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        auth_method = EXCLUDED.auth_method,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        blood_type = EXCLUDED.blood_type,
        emergency_contact = EXCLUDED.emergency_contact,
        preferences = EXCLUDED.preferences,
        is_active = true,
        updated_at = NOW();
    `);
        // ─── Doctors ───
        await pool.query(`
      INSERT INTO doctors (id, clinic_id, name, specialty, rating, review_count, consultation_price, video_price, photo_url, bio, languages)
      VALUES
        ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Dr. Sarah Johnson', 'General Physician', 4.9, 234, 250, 200, 'https://picsum.photos/seed/doc1/200', 'Board certified with 12 years experience in family and internal medicine.', '["English","Arabic"]'),
        ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Dr. Ahmed Khan', 'Cardiologist', 5.0, 189, 450, 350, 'https://picsum.photos/seed/doc2/200', 'Specialist in interventional cardiology with 15 years of clinical practice.', '["English","Arabic","Urdu"]'),
        ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'Dr. Elena Rossi', 'Dermatologist', 4.8, 312, 350, 280, 'https://picsum.photos/seed/doc3/200', 'Expert in cosmetic and clinical dermatology with advanced laser certifications.', '["English","Italian","Arabic"]')
      ON CONFLICT (id) DO UPDATE SET
        clinic_id = EXCLUDED.clinic_id,
        name = EXCLUDED.name,
        specialty = EXCLUDED.specialty,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        consultation_price = EXCLUDED.consultation_price,
        video_price = EXCLUDED.video_price,
        photo_url = EXCLUDED.photo_url,
        bio = EXCLUDED.bio,
        languages = EXCLUDED.languages,
        is_available = true;
    `);
        // ─── Doctor Slots (next 7 days) ───
        const slotTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:15'];
        const doctorIds = [
            'd1000000-0000-0000-0000-000000000001',
            'd1000000-0000-0000-0000-000000000002',
            'd1000000-0000-0000-0000-000000000003',
        ];
        const clinicIds = [
            'a1000000-0000-0000-0000-000000000001',
            'a1000000-0000-0000-0000-000000000002',
            'a1000000-0000-0000-0000-000000000003',
        ];
        // Replace upcoming seeded slots each run so changes always reflect and duplicates are avoided.
        await pool.query(`
      DELETE FROM doctor_slots ds
      WHERE ds.doctor_id = ANY($1::uuid[])
        AND ds.date >= CURRENT_DATE
        AND ds.date < CURRENT_DATE + INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1
          FROM appointments a
          WHERE a.slot_id = ds.i
        );
    `, [doctorIds]);
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = new Date();
            date.setDate(date.getDate() + dayOffset);
            const dateStr = date.toISOString().split('T')[0];
            for (let di = 0; di < doctorIds.length; di++) {
                for (const startTime of slotTimes) {
                    const [h, m] = startTime.split(':').map(Number);
                    const endM = m + 30;
                    const endH = endM >= 60 ? h + 1 : h;
                    const endTime = `${String(endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
                    await pool.query(`
            INSERT INTO doctor_slots (doctor_id, clinic_id, date, start_time, end_time, is_booked, appointment_type)
            VALUES ($1, $2, $3, $4, $5, false, 'in_person')
          `, [doctorIds[di], clinicIds[di], dateStr, startTime, endTime]);
                }
            }
        }
        // ─── Medical Records for demo patient ───
        const patientId = 'b1000000-0000-0000-0000-000000000001';
        // Replace seeded medical records for demo patient each run.
        await pool.query(`
      DELETE FROM medical_records
      WHERE patient_id = $1
        AND (
          (record_type = 'medication' AND title IN ('Metformin', 'Lisinopril', 'Vitamin D3')) OR
          (record_type = 'allergy' AND title IN ('Penicillin', 'Shellfish')) OR
          (record_type = 'diagnosis' AND title IN ('Pre-diabetes (IFG)', 'Vitamin D Deficiency')) OR
          (record_type = 'vital' AND title = 'Vitals Check') OR
          (record_type = 'lab_result' AND title IN ('HbA1c', 'LDL Cholesterol', 'Vitamin D'))
        );
    `, [patientId]);
        await pool.query(`
      INSERT INTO medical_records (patient_id, record_type, title, data) VALUES
        ($1, 'medication', 'Metformin', '{"dosage":"500mg","frequency":"Twice daily","status":"Current","prescribedBy":"Dr. Sarah Johnson"}'),
        ($1, 'medication', 'Lisinopril', '{"dosage":"10mg","frequency":"Once daily","status":"Current","prescribedBy":"Dr. Ahmed Khan"}'),
        ($1, 'medication', 'Vitamin D3', '{"dosage":"5000 IU","frequency":"Once weekly","status":"Current","prescribedBy":"Dr. Sarah Johnson"}'),
        ($1, 'allergy', 'Penicillin', '{"severity":"Moderate","reaction":"Skin rash, itching","reportedDate":"2020-03-15"}'),
        ($1, 'allergy', 'Shellfish', '{"severity":"Mild","reaction":"Hives","reportedDate":"2019-08-22"}'),
        ($1, 'diagnosis', 'Pre-diabetes (IFG)', '{"icd10":"R73.01","diagnosedDate":"2023-01-10","provider":"Dr. Sarah Johnson","status":"Active"}'),
        ($1, 'diagnosis', 'Vitamin D Deficiency', '{"icd10":"E55.9","diagnosedDate":"2022-06-15","provider":"Dr. Sarah Johnson","status":"Monitoring"}'),
        ($1, 'vital', 'Vitals Check', '{"date":"2024-10-15","bp":"120/80","hr":72,"glucose":94,"weight":78,"height":175}'),
        ($1, 'vital', 'Vitals Check', '{"date":"2024-09-01","bp":"125/82","hr":75,"glucose":98,"weight":79,"height":175}'),
        ($1, 'lab_result', 'HbA1c', '{"value":"6.2%","range":"4.0-5.6%","status":"Elevated","date":"2024-10-10"}'),
        ($1, 'lab_result', 'LDL Cholesterol', '{"value":"92 mg/dL","range":"<100 mg/dL","status":"Optimal","date":"2024-10-10"}'),
        ($1, 'lab_result', 'Vitamin D', '{"value":"22 ng/mL","range":"30-100 ng/mL","status":"Low","date":"2024-10-10"}')
    `, [patientId]);
        // ─── Lab Packages ───
        await pool.query(`
      UPDATE lab_packages SET is_active = false;
    `);
        await pool.query(`
      INSERT INTO lab_packages (id, name, description, price, tests, color, is_popular) VALUES
        ('e1000000-0000-0000-0000-000000000001', 'Fatigue Panel (LP-003)', 'Identify nutritional and metabolic causes of chronic tiredness and fatigue.', 299, '["Vitamin B12","Vitamin D","Ferritin","Magnesium","Iron","HbA1c","TIBC","TSH"]', 'bg-blue-600', false),
        ('e1000000-0000-0000-0000-000000000002', 'Diabetic Screening Panel (LP-004)', 'Assess blood sugar regulation and monitor diabetes risk factors effectively.', 99, '["Lipid Panel","Urinalysis","Glucose","HbA1c","CBC"]', 'bg-cyan-600', false),
        ('e1000000-0000-0000-0000-000000000003', 'Hair Loss Panel (LP-005)', 'Investigate deficiencies and hormonal imbalances affecting hair health.', 369, '["Vitamin D","Vitamin B12","Ferritin","Iron","Zinc","Testosterone","Thyroid Profile"]', 'bg-emerald-600', false),
        ('e1000000-0000-0000-0000-000000000004', 'Well Man Panel (LP-006)', 'Comprehensive health assessment tailored for men''s general wellness.', 399, '["Lipid Panel","Vitamin D","PSA","Testosterone","Uric Acid","HbA1c"]', 'bg-indigo-600', false),
        ('e1000000-0000-0000-0000-000000000005', 'Well Woman Panel (LP-007)', 'Comprehensive health assessment tailored for women''s specific needs.', 699, '["Vitamin C","Vitamin D","Ferritin","Iron","TSH","Pap Smear"]', 'bg-pink-600', true),
        ('e1000000-0000-0000-0000-000000000006', 'Obstetrics Panel (LP-008)', 'Essential screening to monitor maternal and fetal health during pregnancy.', 349, '["CBC & Blood","HBsAg","HIV 1/2","Rubella","Coombs Test","Syphilis Test","Urinalysis"]', 'bg-rose-600', false),
        ('e1000000-0000-0000-0000-000000000007', 'Stress Burnout Panel (LP-009)', 'Evaluate the body''s physiological response to chronic stress.', 249, '["Cortisol","Vitamin B12","HbA1c","Magnesium","Thyroid Profile","CBC"]', 'bg-amber-600', false),
        ('e1000000-0000-0000-0000-000000000008', 'Cardiac Screening Panel (LP-011)', 'Analyze heart health and risk factors for cardiovascular disease.', 299, '["Lipid Panel","LFT & Renal","HbA1c","Magnesium","ECG","ESR & hs-CRP","CBC"]', 'bg-red-600', true),
        ('e1000000-0000-0000-0000-000000000009', 'Hormonal Panel - Female (LP-012)', 'Hormonal profile for female endocrine assessment and reproductive wellness.', 649, '["FSH","LH","Estradiol","Progesterone","Prolactin","TSH"]', 'bg-fuchsia-600', false),
        ('e1000000-0000-0000-0000-000000000010', 'Hormonal Panel - Male (LP-013)', 'Hormonal profile for male endocrine assessment and metabolic health.', 639, '["Total Testosterone","Free Testosterone","LH","FSH","Prolactin","TSH"]', 'bg-violet-600', false),
        ('e1000000-0000-0000-0000-000000000011', 'PCOS Panel (LP-014)', 'Comprehensive endocrine screening for polycystic ovary syndrome.', 499, '["FSH","LH","Prolactin","Total Testosterone","DHEA-S","TSH","Insulin"]', 'bg-purple-600', false),
        ('e1000000-0000-0000-0000-000000000012', 'Essential Vitamin Panels (LP-014)', 'Check levels of key vitamins vital for immunity and energy.', 129, '["Vitamin D","Vitamin B12","CBC"]', 'bg-teal-600', false),
        ('e1000000-0000-0000-0000-000000000013', 'Smart Essential Health Package', 'Walk-in preventive screening package for everyday health monitoring.', 179, '["59 Parameters","General Consultation","Complete Blood Count","Lipid Profile","Liver Function Test","Renal Function Test"]', 'bg-sky-600', true),
        ('e1000000-0000-0000-0000-000000000014', 'Smart Total Health Package', 'Walk-in advanced screening package with vitamin and thyroid checks.', 299, '["67 Tests Included","Vitamin Screening","Iron Deficiency Profile","Diabetes Screening","Thyroid Profile"]', 'bg-blue-700', true),
        ('e1000000-0000-0000-0000-000000000015', 'Smart Extra Health Package', 'Walk-in comprehensive package with expanded cardiac and hormonal coverage.', 399, '["79 Tests Included","Advanced Cardiac Risk","Hormonal Profile","Electrolytes","Urine Analysis"]', 'bg-indigo-700', true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        tests = EXCLUDED.tests,
        color = EXCLUDED.color,
        is_popular = EXCLUDED.is_popular,
        is_active = true;
    `);
        // ─── Lab Tests ───
        await pool.query(`
      INSERT INTO lab_tests (id, name, price, category, turnaround_hours) VALUES
        ('f1000000-0000-0000-0000-000000000001', 'Vitamin D', 199, 'Vitamins', 24),
        ('f1000000-0000-0000-0000-000000000002', 'CRP (Inflammation)', 149, 'Immunology', 12),
        ('f1000000-0000-0000-0000-000000000003', 'Thyroid Panel', 299, 'Endocrine', 24),
        ('f1000000-0000-0000-0000-000000000004', 'Iron Deficiency', 159, 'Hematology', 12),
        ('f1000000-0000-0000-0000-000000000005', 'HbA1c', 179, 'Diabetes', 6),
        ('f1000000-0000-0000-0000-000000000006', 'Liver Function Test', 249, 'Organ', 24),
        ('f1000000-0000-0000-0000-000000000007', 'Kidney Function Test', 229, 'Organ', 24),
        ('f1000000-0000-0000-0000-000000000008', 'Complete Blood Count', 99, 'Hematology', 6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        turnaround_hours = EXCLUDED.turnaround_hours,
        is_active = true;
    `);
        // ─── Promotions ───
        await pool.query(`
      INSERT INTO promotions (id, title, description, image_url, clinic_id, discount_percent, valid_from, valid_until)
      VALUES
        ('f2000000-0000-0000-0000-000000000001', '20% OFF Dental Whitening', 'Professional teeth whitening at Smart Care Dental', 'https://picsum.photos/seed/health/800/400', 'a1000000-0000-0000-0000-000000000001', 20, NOW(), NOW() + INTERVAL '30 days'),
        ('f2000000-0000-0000-0000-000000000002', 'Full Body Health Checkup', 'Comprehensive screening starting at AED 999', 'https://picsum.photos/seed/health/800/400', 'a1000000-0000-0000-0000-000000000001', 15, NOW(), NOW() + INTERVAL '60 days'),
        ('f2000000-0000-0000-0000-000000000003', 'Flu Vaccination Drive', 'Free flu shots for all registered patients', 'https://picsum.photos/seed/flu/800/400', NULL, NULL, NOW(), NOW() + INTERVAL '14 days')
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        clinic_id = EXCLUDED.clinic_id,
        discount_percent = EXCLUDED.discount_percent,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until;
    `);
        // ─── Sample Appointment ───
        await pool.query(`
      INSERT INTO appointments (id, patient_id, doctor_id, clinic_id, date, start_time, end_time, type, category, status)
      VALUES (
        'f3000000-0000-0000-0000-000000000001',
        'b1000000-0000-0000-0000-000000000001',
        'd1000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001',
        CURRENT_DATE + INTERVAL '3 days',
        '10:30',
        '11:00',
        'in_person',
        'Consultation',
        'confirmed'
      ) ON CONFLICT (id) DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        doctor_id = EXCLUDED.doctor_id,
        clinic_id = EXCLUDED.clinic_id,
        date = EXCLUDED.date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        type = EXCLUDED.type,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        updated_at = NOW();
    `);
        console.log('✅ Database seeded successfully');
    }
    catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
seed();
//# sourceMappingURL=seed.js.map