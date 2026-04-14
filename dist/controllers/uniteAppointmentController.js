import { z } from 'zod';
import { pool } from '../config/database.js';
import { getUniteClinics, getUniteDoctors, getUniteAvailableSlots, createUniteAppointment, getUniteAppointments, } from '../services/uniteAppointment.js';
import { toIsoDate, toDdMmYyyy, toHhMm24, minutesDiff, shiftIsoDate, formatPhoneForUnite, normalizePhoneDigits, normalizeAppointmentStatus, extractUniteAppointmentRefs, extractUniteStatusCode, extractUniteStartDateTimeParts, extractUnitePhone, extractUniteDoctorId, extractUniteRecordStatus, splitName, toUniteGenderCode, toUnitePhotoType, slotKey, toUniteArray, } from '../utils/appointmentUtils.js';
// ── Validation ───────────────────────────────────────────────────────────────
const createUniteApptSchema = z.object({
    clinic_id: z.string().min(1),
    doctor_id: z.string().min(1),
    date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().optional(),
    notes: z.string().optional(),
    clinic_name: z.string().optional(),
    doctor_name: z.string().optional(),
    specialty: z.string().optional(),
    price: z.union([z.string(), z.number()]).optional(),
});
// ── Route Handlers ───────────────────────────────────────────────────────────
export async function getClinics(_req, res) {
    try {
        const data = await getUniteClinics();
        res.json({ status: 'success', data });
    }
    catch (error) {
        res.status(502).json({ status: 'error', message: error.message });
    }
}
export async function getDoctors(req, res) {
    try {
        const clinicId = String(req.query.clinic_id || '');
        const data = await getUniteDoctors();
        const rows = toUniteArray(data);
        const matchesClinic = (doctor, target) => {
            if (!target)
                return true;
            const directIds = [
                doctor?.clinic_id, doctor?.clinicid, doctor?.clinicId,
                doctor?.clinic?.clinic_id, doctor?.clinic?.id, doctor?.clinic?.code,
            ].map((v) => String(v ?? '').trim()).filter(Boolean);
            if (directIds.includes(target))
                return true;
            for (const list of [doctor?.clinics, doctor?.cliniclist, doctor?.clinic_list].filter(Boolean)) {
                if (Array.isArray(list)) {
                    for (const item of list) {
                        const values = typeof item === 'string'
                            ? [item]
                            : [item?.clinic_id, item?.id, item?.code, item?.clinicid, item?.clinicId];
                        if (values.map((v) => String(v ?? '').trim()).includes(target))
                            return true;
                    }
                }
                else if (typeof list === 'string' && list.split(',').map((v) => v.trim()).includes(target)) {
                    return true;
                }
            }
            return false;
        };
        const filtered = clinicId ? rows.filter((d) => matchesClinic(d, clinicId)) : rows;
        const result = clinicId && filtered.length === 0 ? rows : filtered;
        res.json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(502).json({ status: 'error', message: error.message });
    }
}
export async function getAvailableSlots(req, res) {
    try {
        const clinicId = String(req.query.clinic_id || '');
        const doctorId = String(req.query.doctor_id || '');
        const date = String(req.query.date || '');
        if (!clinicId || !doctorId || !date) {
            return res.status(400).json({ status: 'error', message: 'clinic_id, doctor_id, and date are required' });
        }
        const data = await getUniteAvailableSlots(clinicId, doctorId, date);
        res.json({ status: 'success', data });
    }
    catch (error) {
        res.status(502).json({ status: 'error', message: error.message });
    }
}
export async function createAppointment(req, res) {
    try {
        const body = createUniteApptSchema.parse(req.body);
        const userResult = await pool.query(`SELECT emirates_id, passport_number, emr_id, name, email, phone, date_of_birth, gender
       FROM users WHERE id = $1`, [req.user.userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        const user = userResult.rows[0];
        // Resolve patient identifier
        let patientIdentifier;
        let identifierType;
        if (user.emr_id) {
            patientIdentifier = user.emr_id;
            identifierType = 'emr_id';
        }
        else if (user.emirates_id) {
            patientIdentifier = user.emirates_id;
            identifierType = 'emirates_id';
        }
        else if (user.passport_number) {
            patientIdentifier = user.passport_number;
            identifierType = 'passport_number';
        }
        else {
            return res.status(422).json({
                status: 'error',
                message: 'Cannot book Unite appointment: your account has no government ID or EMR ID on file. Please update your profile with an Emirates ID or passport number.',
            });
        }
        const phone = formatPhoneForUnite(user.phone);
        if (!phone) {
            return res.status(422).json({ status: 'error', message: 'Cannot book Unite appointment: phone number is missing in your profile.' });
        }
        const { firstName, middleName, lastName } = splitName(user.name);
        const gender = toUniteGenderCode(user.gender);
        const date = toDdMmYyyy(body.date);
        const startTime = toHhMm24(body.start_time);
        const endTime = toHhMm24(body.end_time || body.start_time);
        const dob = user.date_of_birth ? toDdMmYyyy(String(user.date_of_birth)) : undefined;
        const photoType = toUnitePhotoType(identifierType);
        const unitePayload = {
            firstname: firstName,
            middlename: middleName,
            lastname: lastName,
            gender,
            mobileno: phone,
            emailid: user.email || '',
            clinicid: body.clinic_id,
            doctorid: body.doctor_id,
            startdatetime: `${date} ${startTime}`,
            duration: String(minutesDiff(startTime, endTime)),
            remarks: body.notes || '',
            requestedby: 'Smart Care App',
        };
        if (dob)
            unitePayload.dob = dob;
        if (photoType && patientIdentifier) {
            unitePayload.phototype = photoType;
            unitePayload.photoid = patientIdentifier;
        }
        const data = await createUniteAppointment(unitePayload);
        const uniteRefs = extractUniteAppointmentRefs(data);
        if (!uniteRefs.appointmentid) {
            return res.status(502).json({
                status: 'error',
                message: 'Unite createappointment succeeded but no appointmentid was returned',
            });
        }
        const mappedStatus = normalizeAppointmentStatus(extractUniteStatusCode(data));
        const mappingResult = await pool.query(`INSERT INTO unite_appointment_mappings
        (patient_id, unite_appointment_id, clinic_id, doctor_id, date, start_time, end_time,
         patient_identifier_used, identifier_type, status, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`, [
            req.user.userId, uniteRefs.appointmentid, body.clinic_id, body.doctor_id,
            toIsoDate(body.date), body.start_time, body.end_time || null,
            patientIdentifier, identifierType, mappedStatus, JSON.stringify({
                uniteResponse: data,
                context: {
                    clinicName: body.clinic_name || null,
                    doctorName: body.doctor_name || null,
                    specialty: body.specialty || null,
                    price: body.price ?? null,
                },
            }),
        ]);
        res.status(201).json({ status: 'success', data, mappingId: mappingResult.rows[0].id });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ status: 'error', message: 'Invalid request', errors: error.errors });
        }
        res.status(502).json({ status: 'error', message: error.message });
    }
}
export async function getAppointments(req, res) {
    try {
        const clinicId = String(req.query.clinic_id || '');
        const fromDate = String(req.query.from_date || '');
        const toDate = String(req.query.to_date || '');
        if (!clinicId || !fromDate || !toDate) {
            return res.status(400).json({ status: 'error', message: 'clinic_id, from_date, and to_date are required' });
        }
        const data = await getUniteAppointments(clinicId, fromDate, toDate);
        res.json({ status: 'success', data });
    }
    catch (error) {
        res.status(502).json({ status: 'error', message: error.message });
    }
}
// ── Sync Logic ───────────────────────────────────────────────────────────────
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
export async function syncUniteAppointmentStatusesForPatient(patientId) {
    const mappingsResult = await pool.query(`SELECT id, unite_appointment_id, clinic_id, doctor_id, date, status, start_time, end_time, raw_response
     FROM unite_appointment_mappings
     WHERE patient_id = $1 AND (status IS NULL OR status != 'cancelled')
     ORDER BY date ASC`, [patientId]);
    const mappings = mappingsResult.rows;
    if (mappings.length === 0)
        return 0;
    // Fetch patient phone for last-resort matching
    let patientPhoneNormalized = '';
    try {
        const phoneRow = await pool.query(`SELECT phone FROM users WHERE id = $1`, [patientId]);
        patientPhoneNormalized = normalizePhoneDigits(phoneRow.rows[0]?.phone);
    }
    catch { /* non-critical */ }
    // Group mappings by clinic
    const clinicGroups = new Map();
    for (const m of mappings) {
        const clinicId = String(m.clinic_id || '').trim();
        const dateStr = toIsoDate(String(m.date || ''));
        if (!clinicId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
            continue;
        if (!clinicGroups.has(clinicId)) {
            clinicGroups.set(clinicId, { minDate: dateStr, maxDate: dateStr, rows: [] });
        }
        const group = clinicGroups.get(clinicId);
        if (dateStr < group.minDate)
            group.minDate = dateStr;
        if (dateStr > group.maxDate)
            group.maxDate = dateStr;
        group.rows.push({ ...m, _normalizedDate: dateStr });
    }
    let updatedCount = 0;
    const matchedMappingIds = new Set();
    // ── Per-clinic sync ──────────────────────────────────────────────────────
    for (const [clinicId, group] of clinicGroups) {
        try {
            const fromDate = toDdMmYyyy(shiftIsoDate(group.minDate, -30));
            const toDate = toDdMmYyyy(shiftIsoDate(group.maxDate, 30));
            const uniteAppts = await getUniteAppointments(clinicId, fromDate, toDate);
            const apptArray = toUniteArray(uniteAppts);
            // Build lookup indexes
            const apptInfoMap = new Map();
            const slotCandidates = new Map();
            const slotCandidatesNoDoc = new Map();
            const dateDoctorCandidates = new Map();
            const dateOnlyCandidates = new Map();
            const phoneDoctorDateCandidates = new Map();
            const phoneDateCandidates = new Map();
            const phoneDoctorCandidates = new Map();
            const phoneOnlyCandidates = new Map();
            for (const ua of apptArray) {
                const refs = extractUniteAppointmentRefs(ua);
                const canonId = refs.appointmentid;
                if (!canonId)
                    continue;
                const status = extractUniteRecordStatus(ua);
                const { date, startTime, endTime } = extractUniteStartDateTimeParts(ua);
                const doctorId = extractUniteDoctorId(ua);
                const info = { canonicalAppointmentId: canonId, status, date, startTime, endTime, doctorId, raw: ua };
                apptInfoMap.set(canonId, info);
                if (refs.appointmentno)
                    apptInfoMap.set(refs.appointmentno, info);
                // Index by slot
                if (date && startTime) {
                    const withDoc = slotKey(date, startTime, doctorId);
                    const noDoc = slotKey(date, startTime, '');
                    slotCandidates.set(withDoc, [...(slotCandidates.get(withDoc) || []), canonId]);
                    slotCandidatesNoDoc.set(noDoc, [...(slotCandidatesNoDoc.get(noDoc) || []), canonId]);
                }
                if (date) {
                    dateOnlyCandidates.set(date, [...(dateOnlyCandidates.get(date) || []), canonId]);
                    if (doctorId) {
                        const key = `${date}|${doctorId}`;
                        dateDoctorCandidates.set(key, [...(dateDoctorCandidates.get(key) || []), canonId]);
                    }
                }
                // Index by phone
                const uaPhone = extractUnitePhone(ua);
                if (uaPhone) {
                    phoneOnlyCandidates.set(uaPhone, [...(phoneOnlyCandidates.get(uaPhone) || []), canonId]);
                    if (date) {
                        const k = `${uaPhone}|${date}`;
                        phoneDateCandidates.set(k, [...(phoneDateCandidates.get(k) || []), canonId]);
                    }
                    if (doctorId) {
                        const k = `${uaPhone}|${doctorId}`;
                        phoneDoctorCandidates.set(k, [...(phoneDoctorCandidates.get(k) || []), canonId]);
                        if (date) {
                            const k2 = `${uaPhone}|${doctorId}|${date}`;
                            phoneDoctorDateCandidates.set(k2, [...(phoneDoctorDateCandidates.get(k2) || []), canonId]);
                        }
                    }
                }
            }
            // Match each mapping to a Unite record
            for (const mapping of group.rows) {
                const mappingRefs = extractUniteAppointmentRefs(mapping.raw_response);
                const lookupKeys = [
                    mappingRefs.appointmentno,
                    String(mapping.unite_appointment_id || '').trim(),
                    mappingRefs.appointmentid,
                ].map((v) => String(v || '').trim()).filter(Boolean);
                let derivedId = '';
                let info;
                // Direct ID lookup
                for (const key of lookupKeys) {
                    const hit = apptInfoMap.get(key);
                    if (hit) {
                        derivedId = key;
                        info = hit;
                        break;
                    }
                }
                // Fallback: slot/date/phone matching
                if (!info) {
                    const localDate = String(mapping._normalizedDate || '');
                    const localTime = String(mapping.start_time || '');
                    const localDocId = String(mapping.doctor_id || '').trim();
                    const withDocCands = slotCandidates.get(slotKey(localDate, localTime, localDocId)) || [];
                    const noDocCands = slotCandidatesNoDoc.get(slotKey(localDate, localTime, '')) || [];
                    const sameDateDocCands = localDocId ? (dateDoctorCandidates.get(`${localDate}|${localDocId}`) || []) : [];
                    const sameDateCands = dateOnlyCandidates.get(localDate) || [];
                    if (withDocCands.length === 1)
                        derivedId = withDocCands[0];
                    else if (!withDocCands.length && noDocCands.length === 1)
                        derivedId = noDocCands[0];
                    else if (sameDateDocCands.length === 1)
                        derivedId = sameDateDocCands[0];
                    else if (sameDateCands.length === 1)
                        derivedId = sameDateCands[0];
                    // Phone-based last resort
                    if (!derivedId && patientPhoneNormalized) {
                        const pddCands = (localDocId && localDate) ? (phoneDoctorDateCandidates.get(`${patientPhoneNormalized}|${localDocId}|${localDate}`) || []) : [];
                        const pDateCands = localDate ? (phoneDateCandidates.get(`${patientPhoneNormalized}|${localDate}`) || []) : [];
                        const pdCands = localDocId ? (phoneDoctorCandidates.get(`${patientPhoneNormalized}|${localDocId}`) || []) : [];
                        const pCands = phoneOnlyCandidates.get(patientPhoneNormalized) || [];
                        if (pddCands.length === 1)
                            derivedId = pddCands[0];
                        else if (!pddCands.length && pDateCands.length === 1)
                            derivedId = pDateCands[0];
                        else if (pdCands.length === 1)
                            derivedId = pdCands[0];
                        else if (!pdCands.length && pCands.length === 1)
                            derivedId = pCands[0];
                    }
                    info = derivedId ? apptInfoMap.get(derivedId) : undefined;
                }
                if (!derivedId || !info)
                    continue;
                matchedMappingIds.add(String(mapping.id));
                const newStatus = normalizeAppointmentStatus(info.status);
                const localStatus = normalizeAppointmentStatus(mapping.status);
                const localDate = String(mapping._normalizedDate || '');
                const localStart = toHhMm24(mapping.start_time);
                const localEnd = toHhMm24(mapping.end_time);
                const canonId = String(info.canonicalAppointmentId || '').trim() || derivedId;
                const statusChanged = !!newStatus && newStatus !== localStatus;
                const dateChanged = !!info.date && info.date !== localDate;
                const timeChanged = !!info.startTime && info.startTime !== localStart;
                const endChanged = !!info.endTime && info.endTime !== localEnd;
                const idNeedsUpdate = !String(mapping.unite_appointment_id || '').trim() ||
                    String(mapping.unite_appointment_id || '').trim() !== canonId;
                if (statusChanged || dateChanged || timeChanged || endChanged || idNeedsUpdate) {
                    await pool.query(`UPDATE unite_appointment_mappings
             SET unite_appointment_id = CASE
                   WHEN $3 IS NULL OR $3 = '' THEN unite_appointment_id
                   WHEN unite_appointment_id IS NULL OR unite_appointment_id = '' OR unite_appointment_id <> $3 THEN $3
                   ELSE unite_appointment_id
                 END,
                 status = COALESCE(NULLIF($1, ''), status),
                 date = COALESCE(NULLIF($4, ''), date),
                 start_time = COALESCE(NULLIF($5, ''), start_time),
                 end_time = COALESCE(NULLIF($6, ''), end_time),
                 raw_response = COALESCE(raw_response, '{}'::jsonb) || $7::jsonb,
                 updated_at = NOW()
             WHERE id = $2`, [
                        newStatus || null, mapping.id, canonId,
                        dateChanged ? info.date : null,
                        timeChanged ? info.startTime : null,
                        endChanged ? info.endTime : null,
                        JSON.stringify({
                            sync: {
                                syncedAt: new Date().toISOString(),
                                uniteAppointmentId: canonId,
                                status: info.status || null,
                                date: info.date || null,
                                startTime: info.startTime || null,
                                endTime: info.endTime || null,
                            },
                        }),
                    ]);
                    updatedCount++;
                }
            }
        }
        catch (error) {
            console.warn('[Unite Sync] Clinic sync skipped', { clinicId, error: error?.message });
        }
    }
    // ── Cross-clinic recovery ──────────────────────────────────────────────────
    const unmatchedMappings = mappings.filter((m) => String(m.unite_appointment_id || '').trim() && !matchedMappingIds.has(String(m.id)));
    if (unmatchedMappings.length > 0) {
        try {
            const clinicsData = await getUniteClinics();
            const allClinicRows = toUniteArray(clinicsData);
            const allClinicIds = Array.from(new Set(allClinicRows.map((c) => String(c?.clinic_id ?? c?.clinicid ?? c?.id ?? c?.code ?? '').trim()).filter(Boolean)));
            for (const mapping of unmatchedMappings) {
                const targetId = String(mapping.unite_appointment_id || '').trim();
                const mappingRefs = extractUniteAppointmentRefs(mapping.raw_response);
                const storedClinic = String(mapping.clinic_id || '').trim();
                const dateStr = toIsoDate(String(mapping.date || ''));
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
                    continue;
                const fromDate = toDdMmYyyy(shiftIsoDate(dateStr, -30));
                const toDate = toDdMmYyyy(shiftIsoDate(dateStr, 30));
                let found = false;
                let hadErrors = false;
                for (const cid of allClinicIds) {
                    if (cid === storedClinic || found)
                        continue;
                    try {
                        const uniteAppts = await getUniteAppointments(cid, fromDate, toDate);
                        for (const ua of toUniteArray(uniteAppts)) {
                            const refs = extractUniteAppointmentRefs(ua);
                            if (!refs.appointmentid)
                                continue;
                            const isMatch = refs.appointmentid === targetId ||
                                (mappingRefs.appointmentno && refs.appointmentno === mappingRefs.appointmentno);
                            if (!isMatch)
                                continue;
                            const status = extractUniteRecordStatus(ua);
                            const { date, startTime, endTime } = extractUniteStartDateTimeParts(ua);
                            const newStatus = normalizeAppointmentStatus(status);
                            await pool.query(`UPDATE unite_appointment_mappings
                 SET clinic_id = $3, unite_appointment_id = $4,
                     status = COALESCE(NULLIF($5, ''), status),
                     date = COALESCE(NULLIF($6, ''), date),
                     start_time = COALESCE(NULLIF($7, ''), start_time),
                     end_time = COALESCE(NULLIF($8, ''), end_time),
                     raw_response = COALESCE(raw_response, '{}'::jsonb) || $9::jsonb,
                     updated_at = NOW()
                 WHERE id = $1 AND patient_id = $2`, [
                                mapping.id, patientId, cid, refs.appointmentid,
                                newStatus || null, date || null, startTime || null, endTime || null,
                                JSON.stringify({
                                    sync: { syncedAt: new Date().toISOString(), crossClinicRecovery: true, oldClinicId: storedClinic, newClinicId: cid },
                                }),
                            ]);
                            updatedCount++;
                            found = true;
                            break;
                        }
                    }
                    catch {
                        hadErrors = true;
                    }
                }
                // If not found in any clinic and no errors, infer cancelled
                if (!found && !hadErrors) {
                    await pool.query(`UPDATE unite_appointment_mappings
             SET status = 'cancelled',
                 raw_response = COALESCE(raw_response, '{}'::jsonb) || $3::jsonb,
                 updated_at = NOW()
             WHERE id = $1 AND patient_id = $2 AND (status IS NULL OR status != 'cancelled')`, [
                        mapping.id, patientId,
                        JSON.stringify({ sync: { syncedAt: new Date().toISOString(), inferredCancelled: true, notFoundInUnite: true } }),
                    ]);
                    updatedCount++;
                    matchedMappingIds.add(String(mapping.id));
                }
            }
        }
        catch (error) {
            console.warn('[Unite Sync] Cross-clinic recovery skipped', { error: error?.message });
        }
    }
    return updatedCount;
}
export async function syncStatuses(req, res) {
    try {
        const updatedCount = await syncUniteAppointmentStatusesForPatient(req.user.userId);
        res.json({ message: 'Sync complete', updated: updatedCount });
    }
    catch (error) {
        res.status(502).json({ status: 'error', message: error.message });
    }
}
//# sourceMappingURL=uniteAppointmentController.js.map