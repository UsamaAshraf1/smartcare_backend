// uniteGateway.ts
import dotenv from 'dotenv';
dotenv.config();
function requireUniteEnv(primaryKey, fallbackKey) {
    const value = process.env[primaryKey] || process.env[fallbackKey];
    if (!value) {
        throw new Error(`[Unite Appointment] Missing required env var: ${primaryKey} (or fallback ${fallbackKey})`);
    }
    return value;
}
const UNITE_BASE_URL = process.env.UNITE_APPOINTMENT_BASE_URL || process.env.UNITE_EMR_BASE_URL;
if (!UNITE_BASE_URL) {
    throw new Error('[Unite Appointment] Missing required env var: UNITE_APPOINTMENT_BASE_URL (or fallback UNITE_EMR_BASE_URL)');
}
const UNITE_APP_ID = requireUniteEnv('UNITE_APPOINTMENT_APP_ID', 'UNITE_EMR_APP_ID');
const UNITE_APP_KEY = requireUniteEnv('UNITE_APPOINTMENT_APP_KEY', 'UNITE_EMR_APP_KEY');
const UNITE_INITIAL_TOKEN = requireUniteEnv('UNITE_APPOINTMENT_TOKEN', 'UNITE_EMR_TOKEN');
let cachedToken = null;
function buildUrl(path, query) {
    const base = `${UNITE_BASE_URL}${path}`;
    if (!query)
        return base;
    const qp = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && String(value).length > 0)
            qp.set(key, String(value));
    }
    const asString = qp.toString();
    return asString ? `${base}?${asString}` : base;
}
function isSuccess(data) {
    const status = String(data?.Status ?? data?.MessageStatus ?? data?.status ?? '').toLowerCase();
    // Unite responses commonly include Status, but if missing and HTTP is ok, treat as ok.
    if (!status)
        return true;
    return status.includes('success');
}
function unwrap(data) {
    return data?.Data ?? data?.data ?? data;
}
/** Accepts YYYY-MM-DD or DD-MM-YYYY, returns YYYY-MM-DD when possible. */
function toIsoDateStr(input) {
    const raw = String(input || '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return raw;
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('-');
        return `${y}-${m}-${d}`;
    }
    return raw;
}
/** Accepts YYYY-MM-DD or DD-MM-YYYY, returns DD-MM-YYYY when possible. */
function toDdMmYyyy(input) {
    const raw = String(input || '').trim().slice(0, 10);
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw))
        return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-');
        return `${d}-${m}-${y}`;
    }
    // If it’s something else, pass through (caller might already have correct format)
    return raw;
}
function parse12HourTime(input) {
    if (!input)
        return null;
    const trimmed = String(input).trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match)
        return null;
    const rawHour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toUpperCase();
    if (!Number.isFinite(rawHour) || !Number.isFinite(minute))
        return null;
    let hour = rawHour % 12;
    if (meridiem === 'PM')
        hour += 12;
    return { hour, minute };
}
function to24HourHHmm(input) {
    const twelve = parse12HourTime(input);
    if (!twelve)
        return String(input || '').trim();
    return `${String(twelve.hour).padStart(2, '0')}:${String(twelve.minute).padStart(2, '0')}`;
}
function addMinutesHHmm(hhmm, minutesToAdd) {
    const match = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match)
        return hhmm;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute))
        return hhmm;
    const total = (hour * 60 + minute + minutesToAdd) % (24 * 60);
    const outHour = Math.floor(total / 60);
    const outMinute = total % 60;
    return `${String(outHour).padStart(2, '0')}:${String(outMinute).padStart(2, '0')}`;
}
function normalizeAvailableSlots(payload, requestedDateIso) {
    // Response shape: { "YYYY-MM-DD": ["09:00 AM", ...], ... }
    // Some older integrations may return DD-MM-YYYY keys.
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const keys = Object.keys(payload);
        const isYYYYMMDD = keys.length > 0 && keys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
        const isDDMMYYYY = keys.length > 0 && keys.every((k) => /^\d{2}-\d{2}-\d{4}$/.test(k));
        if (isYYYYMMDD || isDDMMYYYY) {
            const rows = [];
            for (const rawKey of keys) {
                const date = isDDMMYYYY ? toIsoDateStr(rawKey) : rawKey;
                const times = Array.isArray(payload[rawKey]) ? payload[rawKey] : [];
                for (const t of times) {
                    const start = to24HourHHmm(String(t));
                    rows.push({
                        id: `${date}-${start}`,
                        date,
                        start_time: start,
                        end_time: addMinutesHHmm(start, 15),
                        label: String(t),
                    });
                }
            }
            const targetDate = requestedDateIso ? toIsoDateStr(requestedDateIso) : '';
            const filteredRows = targetDate ? rows.filter((r) => String(r.date || '') === targetDate) : rows;
            filteredRows.sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
            return filteredRows;
        }
    }
    if (Array.isArray(payload)) {
        const rows = payload.map((slot) => {
            const rawDate = String(slot.date || slot.Date || slot.appointmentdate || '');
            const normalizedDate = rawDate ? toIsoDateStr(rawDate.split('T')[0].split(' ')[0]) : '';
            return normalizedDate ? { ...slot, date: normalizedDate } : slot;
        });
        const targetDate = requestedDateIso ? toIsoDateStr(requestedDateIso) : '';
        if (!targetDate)
            return rows;
        const rowsWithDate = rows.filter((r) => String(r?.date || '').trim().length > 0);
        if (rowsWithDate.length === 0)
            return rows;
        return rowsWithDate.filter((r) => String(r.date || '') === targetDate);
    }
    return [];
}
async function authorize() {
    const url = buildUrl('/gateway/authorize', { app_id: UNITE_APP_ID, app_key: UNITE_APP_KEY });
    const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${UNITE_INITIAL_TOKEN}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !isSuccess(data)) {
        throw new Error(data?.Message || data?.DetailMessage || 'Unite authorize failed');
    }
    const token = unwrap(data);
    cachedToken = {
        access_token: String(token.access_token || ''),
        expires_in: Number(token.expires_in || 240), // docs examples use minutes
        refresh_token: String(token.refresh_token || ''),
        obtained_at: Date.now(),
    };
    if (!cachedToken.access_token)
        throw new Error('Unite authorize failed: missing access_token');
    return cachedToken.access_token;
}
async function refreshToken() {
    if (!cachedToken)
        return authorize();
    // Docs show both /gateway/refreshtoken and an example using /gateway/RefreshToken
    const tryPaths = ['/gateway/refreshtoken', '/gateway/RefreshToken'];
    for (const path of tryPaths) {
        const response = await fetch(buildUrl(path), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cachedToken.refresh_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                app_id: UNITE_APP_ID,
                app_key: UNITE_APP_KEY,
                token: cachedToken.access_token, // docs call this "Token"/"token"
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && isSuccess(data)) {
            const token = unwrap(data);
            cachedToken = {
                access_token: String(token.access_token || ''),
                expires_in: Number(token.expires_in || 240),
                refresh_token: String(token.refresh_token || ''),
                obtained_at: Date.now(),
            };
            if (cachedToken.access_token)
                return cachedToken.access_token;
        }
    }
    // If refresh fails, clear cache and do a fresh authorize
    cachedToken = null;
    return authorize();
}
async function getAccessToken() {
    if (!cachedToken)
        return authorize();
    const expiresAt = cachedToken.obtained_at + cachedToken.expires_in * 60 * 1000;
    // refresh 5 minutes before expiry
    if (Date.now() < expiresAt - 5 * 60 * 1000)
        return cachedToken.access_token;
    return refreshToken();
}
async function gatewayGet(path, query) {
    const token = await getAccessToken();
    const response = await fetch(buildUrl(path, query), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !isSuccess(data)) {
        throw new Error(data?.Message || data?.DetailMessage || `Unite GET ${path} failed`);
    }
    return unwrap(data);
}
async function gatewayPost(path, payload) {
    const token = await getAccessToken();
    const response = await fetch(buildUrl(path), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
    });
    const rawText = await response.text();
    let data = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    }
    catch {
        data = {};
    }
    if (!response.ok || !isSuccess(data)) {
        const detail = data?.Message || data?.DetailMessage || rawText || '';
        throw new Error(detail ? `Unite POST ${path} failed: ${detail}` : `Unite POST ${path} failed`);
    }
    return unwrap(data);
}
/** GET /gateway/getclinics */
export async function getUniteClinics() {
    return gatewayGet('/gateway/getclinics');
}
/**
 * GET /gateway/getdoctors
 * Docs show no query params; if you need filtering, do it client-side using the `clinics` list on each doctor.
 */
export async function getUniteDoctors() {
    return gatewayGet('/gateway/getdoctors');
}
/**
 * GET /gateway/getavailableslots?clinic_id=...&doctor_id=...&date=dd-MM-yyyy
 * Docs: request date is dd-MM-yyyy; response keys are YYYY-MM-DD.
 */
export async function getUniteAvailableSlots(clinicId, doctorId, date) {
    const dateParam = toDdMmYyyy(date);
    const requestedDateIso = toIsoDateStr(dateParam);
    // Docs include both /available-slots and /getavailableslots across examples
    try {
        const data = await gatewayGet('/gateway/getavailableslots', {
            clinic_id: clinicId,
            doctor_id: doctorId,
            date: dateParam,
        });
        return normalizeAvailableSlots(data, requestedDateIso);
    }
    catch {
        const data = await gatewayGet('/gateway/available-slots', {
            clinic_id: clinicId,
            doctor_id: doctorId,
            date: dateParam,
        });
        return normalizeAvailableSlots(data, requestedDateIso);
    }
}
/** POST /gateway/createappointment */
export async function createUniteAppointment(payload) {
    return gatewayPost('/gateway/createappointment', payload);
}
/** POST /gateway/createappointmentwithitemdetails */
export async function createUniteAppointmentWithItems(payload) {
    return gatewayPost('/gateway/createappointmentwithitemdetails', payload);
}
/** POST /gateway/updateappointmentstatus */
export async function updateUniteAppointmentStatus(appointmentId, appointmentStatus, remarks) {
    const rawId = String(appointmentId ?? '').trim();
    const numericId = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
    const appointmentid = Number.isSafeInteger(numericId) ? numericId : rawId;
    const payload = {
        appointmentid,
        appointmentstatus: appointmentStatus,
    };
    // remarks is not listed as required for status update; include only if provided
    if (remarks !== undefined)
        payload.remarks = remarks;
    return gatewayPost('/gateway/updateappointmentstatus', payload);
}
/** POST /gateway/updateappointment */
export async function updateUniteAppointment(payload) {
    return gatewayPost('/gateway/updateappointment', payload);
}
/** POST /gateway/updateappointmentwithitemdetails */
export async function updateUniteAppointmentWithItems(payload) {
    return gatewayPost('/gateway/updateappointmentwithitemdetails', payload);
}
/**
 * GET /gateway/getallappointments?clinic_id=...&from_date=dd-MM-yyyy&to_date=dd-MM-yyyy
 */
export async function getUniteAppointments(clinicId, fromDate, toDate) {
    return gatewayGet('/gateway/getallappointments', {
        clinic_id: clinicId,
        from_date: toDdMmYyyy(fromDate),
        to_date: toDdMmYyyy(toDate),
    });
}
/** GET /gateway/getitemdetails */
export async function getUniteItemDetails() {
    return gatewayGet('/gateway/getitemdetails');
}
/** POST /gateway/createinvoice */
export async function createUniteInvoice(payload) {
    return gatewayPost('/gateway/createinvoice', payload);
}
//# sourceMappingURL=uniteAppointment.js.map