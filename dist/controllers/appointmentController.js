import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAppointmentSchema } from '../middleware/validators.js';
import { updateUniteAppointmentStatus, updateUniteAppointment, getUniteAppointments } from '../services/uniteAppointment.js';
import { syncUniteAppointmentStatusesForPatient } from './uniteAppointmentController.js';
import { toIsoDate, toDdMmYyyy, toHhMm24, minutesDiff, shiftIsoDate, formatPhoneForUnite, normalizePhoneDigits, normalizeAppointmentStatus, extractUniteAppointmentRefs, extractUniteAppointmentId, extractUniteStatusCode, extractUniteStartDateTimeParts, extractUnitePhone, toUniteIdValue, splitName, toUniteGenderCode, toUnitePhotoType, toUniteArray, } from '../utils/appointmentUtils.js';
// ── Mapping helpers ──────────────────────────────────────────────────────────
function mapUniteRow(row) {
    const raw = row.raw_response || {};
    const context = raw?.context || {};
    return {
        id: `unite-${row.id}`,
        source: 'unite',
        external_appointment_id: row.unite_appointment_id,
        category: 'Consultation',
        doctor_name: context.doctorName || row.doctor_id,
        specialty: context.specialty || 'General',
        doctor_photo: null,
        consultation_price: Number(context.price || 0),
        clinic_name: context.clinicName || row.clinic_id,
        clinic_location: context.clinicLocation || '',
        date: toIsoDate(row.date),
        start_time: toHhMm24(row.start_time),
        end_time: toHhMm24(row.end_time || row.start_time),
        status: normalizeAppointmentStatus(row.status),
        notes: raw?.notes || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function pdfSafeText(value) {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[^\x20-\x7E\n]/g, '?');
}
function pdfEscape(text) {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function wrapPdfLine(text, maxLen = 78) {
    const clean = pdfSafeText(text).trimEnd();
    if (!clean)
        return [''];
    if (clean.length <= maxLen)
        return [clean];
    const words = clean.split(/\s+/);
    const out = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxLen) {
            current = next;
            continue;
        }
        if (current)
            out.push(current);
        current = word.length > maxLen ? word.slice(0, maxLen) : word;
    }
    if (current)
        out.push(current);
    return out.length ? out : [''];
}
function buildSimplePdf(lines) {
    const wrappedLines = lines.flatMap((line) => wrapPdfLine(line));
    const contentOps = ['BT', '/F1 12 Tf', '50 750 Td', '16 TL'];
    wrappedLines.forEach((line, index) => {
        if (index > 0)
            contentOps.push('T*');
        contentOps.push(`(${pdfEscape(line)}) Tj`);
    });
    contentOps.push('ET');
    const contentStream = `${contentOps.join('\n')}\n`;
    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'latin1')} >>\nstream\n${contentStream}endstream\nendobj\n`,
    ];
    let pdf = '%PDF-1.4\n%\xC2\xC3\xCF\xD3\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += obj;
    }
    const xrefStart = Buffer.byteLength(pdf, 'latin1');
    const xrefRows = offsets
        .map((offset, index) => {
        if (index === 0)
            return '0000000000 65535 f ';
        return `${String(offset).padStart(10, '0')} 00000 n `;
    })
        .join('\n');
    pdf += `xref\n0 ${offsets.length}\n${xrefRows}\n`;
    pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
}
// ── Route Handlers ───────────────────────────────────────────────────────────
export async function getAppointments(req, res, next) {
    try {
        // Sync Unite statuses before returning appointments
        await syncUniteAppointmentStatusesForPatient(req.user.userId).catch((error) => {
            console.warn('[Unite Sync] prefetch sync failed', { userId: req.user.userId, error: error?.message });
        });
        const { status, upcoming } = req.query;
        const [localResult, uniteResult] = await Promise.all([
            pool.query(`SELECT a.*, d.name as doctor_name, d.specialty, d.photo_url as doctor_photo,
                d.consultation_price, c.name as clinic_name, c.location as clinic_location
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         JOIN clinics c ON a.clinic_id = c.id
         WHERE a.patient_id = $1
         ORDER BY a.date DESC, a.start_time ASC`, [req.user.userId]),
            pool.query(`SELECT * FROM unite_appointment_mappings
         WHERE patient_id = $1
         ORDER BY date DESC, start_time ASC`, [req.user.userId]),
        ]);
        const localRows = (localResult.rows || []).map((row) => ({
            ...row,
            source: 'local',
            date: toIsoDate(row.date),
            start_time: toHhMm24(row.start_time),
            end_time: toHhMm24(row.end_time),
            status: normalizeAppointmentStatus(row.status),
        }));
        const uniteRows = (uniteResult.rows || []).map(mapUniteRow);
        let merged = [...localRows, ...uniteRows];
        const targetStatus = status ? String(status).toLowerCase() : '';
        if (targetStatus) {
            merged = merged.filter((row) => normalizeAppointmentStatus(row.status) === targetStatus);
        }
        if (upcoming === 'true') {
            const today = new Date().toISOString().slice(0, 10);
            merged = merged.filter((row) => toIsoDate(row.date) >= today && normalizeAppointmentStatus(row.status) !== 'cancelled');
        }
        merged.sort((a, b) => {
            const byDate = toIsoDate(b.date).localeCompare(toIsoDate(a.date));
            return byDate !== 0 ? byDate : toHhMm24(a.start_time).localeCompare(toHhMm24(b.start_time));
        });
        res.json(merged);
    }
    catch (error) {
        next(error);
    }
}
export async function getAppointmentById(req, res, next) {
    try {
        const appointmentId = String(req.params.id || '');
        if (appointmentId.startsWith('unite-')) {
            await syncUniteAppointmentStatusesForPatient(req.user.userId).catch((e) => {
                console.warn('[Unite Sync] getById sync failed', { appointmentId, error: e?.message });
            });
            const mappingId = appointmentId.slice('unite-'.length);
            const mapping = await pool.query(`SELECT * FROM unite_appointment_mappings WHERE id = $1 AND patient_id = $2`, [mappingId, req.user.userId]);
            if (mapping.rows.length === 0)
                throw new AppError('Appointment not found', 404);
            res.json(mapUniteRow(mapping.rows[0]));
            return;
        }
        const result = await pool.query(`SELECT a.*, d.name as doctor_name, d.specialty, d.photo_url as doctor_photo,
              d.consultation_price, c.name as clinic_name, c.location as clinic_location, c.address as clinic_address
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.id = $1 AND a.patient_id = $2`, [req.params.id, req.user.userId]);
        if (result.rows.length === 0)
            throw new AppError('Appointment not found', 404);
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
export async function createAppointment(req, res, next) {
    try {
        const data = createAppointmentSchema.parse(req.body);
        if (data.slotId) {
            const slotCheck = await pool.query('SELECT id FROM doctor_slots WHERE id = $1 AND is_booked = false AND is_blocked = false', [data.slotId]);
            if (slotCheck.rows.length === 0)
                throw new AppError('Selected time slot is no longer available', 409);
        }
        const result = await pool.query(`INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_id, date, start_time, end_time, type, category, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_payment')
       RETURNING *`, [req.user.userId, data.doctorId, data.clinicId, data.slotId, data.date, data.startTime, data.endTime, data.type, data.category, data.notes]);
        if (data.slotId) {
            await pool.query('UPDATE doctor_slots SET is_booked = true WHERE id = $1', [data.slotId]);
        }
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
// ── Cancel ───────────────────────────────────────────────────────────────────
export async function cancelAppointment(req, res, next) {
    try {
        const { reason } = req.body;
        const rawId = String(req.params.id || '');
        const cancelUniteByMappingId = async (mappingId) => {
            const mapping = await pool.query(`SELECT * FROM unite_appointment_mappings WHERE id = $1 AND patient_id = $2`, [mappingId, req.user.userId]);
            if (mapping.rows.length === 0)
                throw new AppError('Appointment not found or cannot be cancelled', 404);
            const row = mapping.rows[0];
            if (normalizeAppointmentStatus(row.status) === 'cancelled') {
                throw new AppError('Appointment not found or cannot be cancelled', 404);
            }
            const refs = extractUniteAppointmentRefs(row.raw_response);
            const appointmentids = Array.from(new Set([String(row.unite_appointment_id || '').trim(), refs.appointmentid || ''].filter(Boolean)));
            // Build Unite update payload for full-update cancellation
            const buildCancelPayload = async (appointmentid) => {
                const userResult = await pool.query(`SELECT emirates_id, passport_number, emr_id, name, email, phone, date_of_birth, gender FROM users WHERE id = $1`, [req.user.userId]);
                if (userResult.rows.length === 0)
                    throw new AppError('User not found', 404);
                const user = userResult.rows[0];
                const { firstName, middleName, lastName } = splitName(user.name);
                const phone = formatPhoneForUnite(user.phone);
                if (!phone)
                    throw new AppError('Cannot cancel Unite appointment: phone number is missing', 422);
                const gender = toUniteGenderCode(user.gender);
                const dob = user.date_of_birth ? toDdMmYyyy(String(user.date_of_birth)) : undefined;
                const photoType = toUnitePhotoType(String(row.identifier_type || ''));
                const patientId = String(row.patient_identifier_used || user.emr_id || user.emirates_id || user.passport_number || '').trim();
                const dateFmt = toDdMmYyyy(toIsoDate(row.date));
                const startFmt = toHhMm24(row.start_time);
                const endFmt = toHhMm24(row.end_time || row.start_time);
                const payload = {
                    appointmentid: toUniteIdValue(appointmentid),
                    firstname: firstName, middlename: middleName, lastname: lastName,
                    gender, mobileno: phone, emailid: user.email || '',
                    clinicid: String(row.clinic_id || ''),
                    doctorid: String(row.doctor_id || ''),
                    startdatetime: `${dateFmt} ${startFmt}`,
                    duration: String(minutesDiff(startFmt, endFmt)),
                    remarks: String(reason || 'Cancelled by patient'),
                    requestedby: 'Smart Care App',
                    appointmentstatus: 'CVI',
                };
                if (dob)
                    payload.dob = dob;
                if (photoType && patientId) {
                    payload.phototype = photoType;
                    payload.photoid = patientId;
                }
                return payload;
            };
            // Try cancel via updateappointment (preferred), then updateappointmentstatus
            const tryCancelPreferred = async (appointmentid) => {
                try {
                    const payload = await buildCancelPayload(appointmentid);
                    const result = await updateUniteAppointment(payload);
                    const returnedStatus = extractUniteStatusCode(result);
                    if (returnedStatus && normalizeAppointmentStatus(returnedStatus) !== 'cancelled') {
                        throw new AppError(`Unite did not confirm cancellation (status: ${returnedStatus})`, 502);
                    }
                    return { uniteUpdate: result, mode: 'updateappointment' };
                }
                catch (updateErr) {
                    try {
                        const statusResult = await updateUniteAppointmentStatus(appointmentid, 'CVI');
                        const rawStatus = String(statusResult?.appointmentstatus ?? '').trim();
                        if (rawStatus && normalizeAppointmentStatus(rawStatus) !== 'cancelled') {
                            throw new AppError(`Unite did not confirm cancellation (status: ${rawStatus})`, 502);
                        }
                        return { uniteUpdate: statusResult, mode: 'updateappointmentstatus' };
                    }
                    catch {
                        throw updateErr;
                    }
                }
            };
            // Resolve canonical ID via getallappointments if stored IDs fail
            const resolveCanonicalId = async () => {
                const clinicId = String(row.clinic_id || '').trim();
                const rowDateIso = toIsoDate(row.date);
                if (!clinicId || !/^\d{4}-\d{2}-\d{2}$/.test(rowDateIso))
                    return null;
                const fromDate = toDdMmYyyy(shiftIsoDate(rowDateIso, -30));
                const toDate = toDdMmYyyy(shiftIsoDate(rowDateIso, 30));
                const rawStart = toHhMm24(row.start_time);
                const rowDoctorId = String(row.doctor_id || '').trim();
                const phoneRow = await pool.query(`SELECT phone FROM users WHERE id = $1`, [req.user.userId]);
                const userPhone = normalizePhoneDigits(phoneRow.rows[0]?.phone);
                const apptArray = toUniteArray(await getUniteAppointments(clinicId, fromDate, toDate));
                let byApptNo = null;
                const slotMatches = [];
                const phoneDateMatches = [];
                for (const ua of apptArray) {
                    const uaRefs = extractUniteAppointmentRefs(ua);
                    if (!uaRefs.appointmentid)
                        continue;
                    if (refs.appointmentno && uaRefs.appointmentno === refs.appointmentno) {
                        byApptNo = uaRefs.appointmentid;
                        break;
                    }
                    const parsed = extractUniteStartDateTimeParts(ua);
                    const doctorId = String(ua?.doctor_id ?? ua?.doctorid ?? '').trim();
                    if (parsed.date === rowDateIso && parsed.startTime === rawStart) {
                        if (!rowDoctorId || !doctorId || doctorId === rowDoctorId)
                            slotMatches.push(uaRefs.appointmentid);
                    }
                    if (userPhone && parsed.date === rowDateIso) {
                        const uaPhone = normalizePhoneDigits(extractUnitePhone(ua));
                        if (uaPhone && uaPhone === userPhone)
                            phoneDateMatches.push(uaRefs.appointmentid);
                    }
                }
                if (byApptNo)
                    return byApptNo;
                if (slotMatches.length === 1)
                    return slotMatches[0];
                if (phoneDateMatches.length === 1)
                    return phoneDateMatches[0];
                return null;
            };
            // Execute cancellation attempts
            let cancelOutcome = null;
            let cancelledId = null;
            let lastError = null;
            for (const id of appointmentids) {
                try {
                    cancelOutcome = await tryCancelPreferred(id);
                    cancelledId = id;
                    break;
                }
                catch (err) {
                    lastError = err;
                    console.warn('[Unite Cancel] Attempt failed', { mappingId, appointmentid: id, error: err?.message });
                }
            }
            if (!cancelOutcome) {
                try {
                    const canonId = await resolveCanonicalId();
                    if (canonId && !appointmentids.includes(canonId)) {
                        cancelOutcome = await tryCancelPreferred(canonId);
                        cancelledId = canonId;
                    }
                }
                catch (err) {
                    lastError = err;
                }
            }
            if (!cancelOutcome || !cancelledId) {
                if (lastError instanceof AppError)
                    throw lastError;
                if (lastError)
                    throw new AppError(lastError?.message || 'Failed to cancel Unite appointment', 502);
                throw new AppError('Cannot cancel: Unite appointment ID is missing', 422);
            }
            const updated = await pool.query(`UPDATE unite_appointment_mappings
         SET status = 'cancelled',
             unite_appointment_id = CASE
               WHEN unite_appointment_id IS NULL OR unite_appointment_id = '' OR unite_appointment_id <> $4 THEN $4
               ELSE unite_appointment_id
             END,
             raw_response = COALESCE(raw_response, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND patient_id = $2
         RETURNING *`, [
                mappingId, req.user.userId,
                JSON.stringify({
                    cancel: { reason: reason || 'patient', cancelledAt: new Date().toISOString(), appointmentid: cancelledId, mode: cancelOutcome.mode },
                }),
                cancelledId,
            ]);
            return updated.rows[0];
        };
        // Cancel linked Unite appointment for a local appointment
        const cancelLinkedUnite = async (localAppointmentId) => {
            const linked = await pool.query(`SELECT id FROM unite_appointment_mappings
         WHERE local_appointment_id = $1 AND patient_id = $2
         ORDER BY created_at DESC LIMIT 1`, [localAppointmentId, req.user.userId]);
            if (linked.rows.length === 0)
                return null;
            try {
                return await cancelUniteByMappingId(String(linked.rows[0].id));
            }
            catch (err) {
                if (err instanceof AppError && err.statusCode === 404)
                    return null;
                throw err;
            }
        };
        // ── Handle Unite appointment cancel ──
        if (rawId.startsWith('unite-')) {
            await syncUniteAppointmentStatusesForPatient(req.user.userId).catch(() => { });
            const mappingId = rawId.slice('unite-'.length);
            const updated = await cancelUniteByMappingId(mappingId);
            res.json({ message: 'Appointment cancelled', appointment: mapUniteRow(updated) });
            return;
        }
        // ── Handle Local appointment cancel ──
        const result = await pool.query(`UPDATE appointments
       SET status = 'cancelled', cancellation_reason = $3, updated_at = NOW()
       WHERE id = $1 AND patient_id = $2 AND status NOT IN ('completed', 'cancelled')
       RETURNING *, slot_id`, [req.params.id, req.user.userId, reason]);
        if (result.rows.length === 0) {
            // Try as Unite mapping id
            const updated = await cancelUniteByMappingId(rawId);
            res.json({ message: 'Appointment cancelled', appointment: mapUniteRow(updated) });
            return;
        }
        if (result.rows[0].slot_id) {
            await pool.query('UPDATE doctor_slots SET is_booked = false WHERE id = $1', [result.rows[0].slot_id]);
        }
        const linkedUnite = await cancelLinkedUnite(rawId);
        res.json({
            message: 'Appointment cancelled',
            appointment: result.rows[0],
            ...(linkedUnite ? { linked_unite_appointment: mapUniteRow(linkedUnite) } : {}),
        });
    }
    catch (error) {
        next(error);
    }
}
// ── Reschedule ───────────────────────────────────────────────────────────────
export async function rescheduleAppointment(req, res, next) {
    try {
        const { newSlotId, newDate, newStartTime, newEndTime, clinic_id, doctor_id } = req.body;
        const rawId = String(req.params.id || '');
        // ── Unite reschedule ──
        if (rawId.startsWith('unite-')) {
            const mappingId = rawId.slice('unite-'.length);
            const mappingResult = await pool.query(`SELECT * FROM unite_appointment_mappings WHERE id = $1 AND patient_id = $2`, [mappingId, req.user.userId]);
            if (mappingResult.rows.length === 0)
                throw new AppError('Appointment not found', 404);
            const row = mappingResult.rows[0];
            const oldUniteId = String(row.unite_appointment_id || '').trim() || extractUniteAppointmentId(row.raw_response);
            if (!oldUniteId)
                throw new AppError('Cannot reschedule: Unite appointment ID not found', 422);
            const userResult = await pool.query(`SELECT emirates_id, passport_number, emr_id, name, email, phone, date_of_birth, gender FROM users WHERE id = $1`, [req.user.userId]);
            const user = userResult.rows[0];
            const { firstName, middleName, lastName } = splitName(user.name);
            const phone = formatPhoneForUnite(user.phone);
            const gender = toUniteGenderCode(user.gender);
            const dob = user.date_of_birth ? toDdMmYyyy(String(user.date_of_birth)) : undefined;
            const targetClinic = clinic_id || row.clinic_id;
            const targetDoctor = doctor_id || row.doctor_id;
            const dateFmt = toDdMmYyyy(newDate);
            const startFmt = toHhMm24(newStartTime);
            const endFmt = toHhMm24(newEndTime || newStartTime);
            const photoType = toUnitePhotoType(String(row.identifier_type || ''));
            const patientId = String(row.patient_identifier_used || '').trim();
            const updatePayload = {
                appointmentid: toUniteIdValue(oldUniteId),
                firstname: firstName, middlename: middleName, lastname: lastName,
                gender, mobileno: phone, emailid: user.email || '',
                clinicid: targetClinic, doctorid: targetDoctor,
                startdatetime: `${dateFmt} ${startFmt}`,
                duration: String(minutesDiff(startFmt, endFmt)),
                remarks: 'Rescheduled by Patient', requestedby: 'Smart Care App',
            };
            if (dob)
                updatePayload.dob = dob;
            if (photoType && patientId) {
                updatePayload.phototype = photoType;
                updatePayload.photoid = patientId;
            }
            const updateResult = await updateUniteAppointment(updatePayload);
            const mappedStatus = normalizeAppointmentStatus(extractUniteStatusCode(updateResult)) || 'confirmed';
            const updated = await pool.query(`UPDATE unite_appointment_mappings
         SET date = $3, start_time = $4, end_time = $5,
             clinic_id = $6, doctor_id = $7, status = $8,
             raw_response = raw_response || $9::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND patient_id = $2
         RETURNING *`, [
                mappingId, req.user.userId, newDate, newStartTime, newEndTime || null,
                targetClinic, targetDoctor, mappedStatus,
                JSON.stringify({ reschedule: { uniteAppointmentId: oldUniteId, updateResult, rescheduledAt: new Date().toISOString() } }),
            ]);
            res.json(mapUniteRow(updated.rows[0]));
            return;
        }
        // ── Local reschedule ──
        const old = await pool.query('SELECT slot_id FROM appointments WHERE id = $1 AND patient_id = $2', [req.params.id, req.user.userId]);
        if (old.rows.length === 0)
            throw new AppError('Appointment not found', 404);
        if (old.rows[0].slot_id) {
            await pool.query('UPDATE doctor_slots SET is_booked = false WHERE id = $1', [old.rows[0].slot_id]);
        }
        if (newSlotId) {
            await pool.query('UPDATE doctor_slots SET is_booked = true WHERE id = $1', [newSlotId]);
        }
        const result = await pool.query(`UPDATE appointments
       SET slot_id = $3, date = $4, start_time = $5, end_time = $6, updated_at = NOW()
       WHERE id = $1 AND patient_id = $2
       RETURNING *`, [req.params.id, req.user.userId, newSlotId, newDate, newStartTime, newEndTime]);
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
export async function getPastVisits(req, res, next) {
    try {
        const result = await pool.query(`SELECT a.*, d.name as doctor_name, d.specialty, c.name as clinic_name
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.patient_id = $1 AND (a.date < CURRENT_DATE OR a.status = 'completed')
       ORDER BY a.date DESC LIMIT 20`, [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function downloadPastVisitSummaryPdf(req, res, next) {
    try {
        const visitId = String(req.params.id || '').trim();
        if (!visitId)
            throw new AppError('Visit ID is required', 400);
        const result = await pool.query(`SELECT a.*, d.name as doctor_name, d.specialty, c.name as clinic_name, c.location as clinic_location
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.id = $1 AND a.patient_id = $2 AND (a.date < CURRENT_DATE OR a.status = 'completed')
       LIMIT 1`, [visitId, req.user.userId]);
        if (result.rows.length === 0) {
            throw new AppError('Past visit record not found', 404);
        }
        const visit = result.rows[0];
        const date = visit.date ? toIsoDate(visit.date) : '';
        const startTime = visit.start_time ? toHhMm24(visit.start_time) : '';
        const endTime = visit.end_time ? toHhMm24(visit.end_time) : '';
        const status = normalizeAppointmentStatus(visit.status || 'completed');
        const filename = `visit-summary-${visitId}.pdf`;
        const pdf = buildSimplePdf([
            'SMART CARE POLYCLINIC',
            'Visit Summary (System Generated)',
            '',
            `Visit ID: ${visitId}`,
            `Date: ${date || 'N/A'}`,
            `Time: ${startTime || 'N/A'}${endTime ? ` - ${endTime}` : ''}`,
            `Doctor: ${visit.doctor_name || 'N/A'}`,
            `Specialty: ${visit.specialty || 'N/A'}`,
            `Clinic: ${visit.clinic_name || 'N/A'}`,
            `Location: ${visit.clinic_location || 'N/A'}`,
            `Status: ${status}`,
            '',
            'Note:',
            'This is an appointment visit summary generated from booking records.',
            'It is not a clinical diagnosis or discharge summary.',
        ]);
        res.json({
            filename,
            mimeType: 'application/pdf',
            base64: pdf.toString('base64'),
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=appointmentController.js.map