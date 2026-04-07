import { pool } from '../config/database.js';
import { getRecentRecords } from '../services/uniteEmr.js';
export async function getMedicalRecords(req, res, next) {
    try {
        const { type } = req.query;
        let query = 'SELECT * FROM medical_records WHERE patient_id = $1 AND is_active = true';
        const params = [req.user.userId];
        if (type) {
            params.push(type);
            query += ` AND record_type = $${params.length}`;
        }
        query += ' ORDER BY recorded_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getMedications(req, res, next) {
    try {
        const result = await pool.query("SELECT * FROM medical_records WHERE patient_id = $1 AND record_type = 'medication' AND is_active = true ORDER BY recorded_at DESC", [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getAllergies(req, res, next) {
    try {
        const result = await pool.query("SELECT * FROM medical_records WHERE patient_id = $1 AND record_type = 'allergy' AND is_active = true", [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getDiagnoses(req, res, next) {
    try {
        const result = await pool.query("SELECT * FROM medical_records WHERE patient_id = $1 AND record_type = 'diagnosis' AND is_active = true ORDER BY recorded_at DESC", [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getVitals(req, res, next) {
    try {
        const result = await pool.query("SELECT * FROM medical_records WHERE patient_id = $1 AND record_type = 'vital' ORDER BY recorded_at DESC LIMIT 20", [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getLabResults(req, res, next) {
    try {
        const result = await pool.query("SELECT * FROM medical_records WHERE patient_id = $1 AND record_type = 'lab_result' ORDER BY recorded_at DESC", [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function syncFaceVitalsRecord(req, res, next) {
    try {
        const patientId = req.user.userId;
        const { scanId, vitals, summary, scanTarget } = req.body || {};
        if (!scanId || !vitals) {
            res.status(400).json({ error: 'scanId and vitals are required' });
            return;
        }
        // scanTarget: 'self' (default) or 'other'
        const target = scanTarget === 'other' ? 'other' : 'self';
        const existing = await pool.query(`SELECT id
       FROM medical_records
       WHERE patient_id = $1
         AND record_type = 'vital'
         AND data->>'source' = 'face_vitals'
         AND data->>'scanId' = $2
       LIMIT 1`, [patientId, String(scanId)]);
        if (existing.rows.length > 0) {
            res.json({
                message: 'Face Vitals record already synced',
                recordId: existing.rows[0].id,
            });
            return;
        }
        const title = target === 'other' ? 'Face Vitals Scan (Other Person)' : 'Face Vitals Scan';
        const payload = {
            source: 'face_vitals',
            scanTarget: target,
            scanId: String(scanId),
            summary: summary || null,
            vitals,
            syncedAt: new Date().toISOString(),
        };
        const inserted = await pool.query(`INSERT INTO medical_records (patient_id, record_type, title, data, recorded_by, recorded_at)
       VALUES ($1, 'vital', $2, $3::jsonb, $1, NOW())
       RETURNING id, title, recorded_at`, [patientId, title, JSON.stringify(payload)]);
        res.status(201).json({
            message: 'Face Vitals synced to records',
            record: inserted.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
}
export async function syncUniteRecords(req, res, next) {
    try {
        const patientId = req.user.userId;
        const days = Number(req.body?.days || 30);
        const boundedDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 30;
        const userResult = await pool.query('SELECT emr_id, emirates_id, passport_number, name FROM users WHERE id = $1', [patientId]);
        if (userResult.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const user = userResult.rows[0];
        if (!user.emr_id && !user.emirates_id && !user.passport_number) {
            res.status(422).json({
                error: 'Cannot sync EMR records: no government ID or EMR ID on your profile',
                hint: 'Please update your profile with an Emirates ID or passport number first',
            });
            return;
        }
        const emrRecords = await getRecentRecords(boundedDays);
        // Build set of all local identifiers for this user
        const normalize = (v) => String(v || '').trim().toLowerCase();
        const localIds = [user.emr_id, user.emirates_id, user.passport_number]
            .filter(Boolean)
            .map(normalize);
        // Cross-match every local ID against every EMR identity field (patientPin + photoid/emiratesId).
        // Clinics may file a patient under Emirates ID in one field and passport in another,
        // or use Emirates ID as patientPin — so we check all combinations.
        const target = emrRecords.find((p) => {
            const emrIds = [p.patientPin, p.emiratesId].filter(Boolean).map(normalize);
            return localIds.some((lid) => emrIds.includes(lid));
        }) ?? null;
        if (!target) {
            res.status(404).json({
                error: 'No matching Unite EMR patient record found for this user',
                hint: 'Ensure your Emirates ID or passport number in your profile matches the clinic records',
            });
            return;
        }
        const inserts = [];
        for (const allergy of target.allergies || []) {
            inserts.push({
                recordType: 'allergy',
                title: allergy.type || allergy.reaction || 'Allergy',
                data: {
                    source: 'unite_emr',
                    patientPin: target.patientPin,
                    ...allergy,
                },
            });
        }
        for (const visit of target.visits || []) {
            for (const diagnosis of visit.diagnoses || []) {
                inserts.push({
                    recordType: 'diagnosis',
                    title: diagnosis.description || diagnosis.code || 'Diagnosis',
                    data: {
                        source: 'unite_emr',
                        patientPin: target.patientPin,
                        visitDate: visit.date,
                        doctor: visit.doctor,
                        clinic: visit.clinic,
                        ...diagnosis,
                    },
                });
            }
            for (const medication of visit.medications || []) {
                inserts.push({
                    recordType: 'medication',
                    title: medication.name || medication.code || 'Medication',
                    data: {
                        source: 'unite_emr',
                        patientPin: target.patientPin,
                        visitDate: visit.date,
                        doctor: visit.doctor,
                        clinic: visit.clinic,
                        ...medication,
                    },
                });
            }
            for (const vital of visit.vitals || []) {
                inserts.push({
                    recordType: 'vital',
                    title: 'Vitals Check',
                    data: {
                        source: 'unite_emr',
                        patientPin: target.patientPin,
                        visitDate: visit.date,
                        doctor: visit.doctor,
                        clinic: visit.clinic,
                        ...vital,
                    },
                });
            }
            for (const [category, items] of Object.entries(visit.items || {})) {
                for (const item of items) {
                    inserts.push({
                        recordType: 'lab_result',
                        title: item.description || item.code || 'Lab Result',
                        data: {
                            source: 'unite_emr',
                            patientPin: target.patientPin,
                            visitDate: visit.date,
                            doctor: visit.doctor,
                            clinic: visit.clinic,
                            category,
                            ...item,
                        },
                    });
                }
            }
        }
        await pool.query('BEGIN');
        try {
            await pool.query(`DELETE FROM medical_records
         WHERE patient_id = $1
           AND data->>'source' = 'unite_emr'`, [patientId]);
            for (const row of inserts) {
                await pool.query(`INSERT INTO medical_records (patient_id, record_type, title, data, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4::jsonb, $1, NOW())`, [patientId, row.recordType, row.title, JSON.stringify(row.data)]);
            }
            await pool.query('COMMIT');
        }
        catch (txError) {
            await pool.query('ROLLBACK');
            throw txError;
        }
        res.json({
            message: 'Unite EMR records synced successfully',
            syncedPatient: {
                patientPin: target.patientPin,
                name: target.name,
            },
            inserted: inserts.length,
            days: boundedDays,
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=medicalRecordController.js.map