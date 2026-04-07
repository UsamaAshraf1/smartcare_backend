/**
 * appointmentUtils.ts
 * Shared utility functions for appointment controllers.
 * Eliminates duplication between appointmentController and uniteAppointmentController.
 */

// ── Date formatting ──────────────────────────────────────────────────────────

/** Extract YYYY-MM-DD from any date-like string (ISO, DD-MM-YYYY, datetime). */
export function toIsoDate(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
    const [d, m, y] = datePart.split('-');
    return `${y}-${m}-${d}`;
  }
  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  return datePart.slice(0, 10);
}

/** Convert to DD-MM-YYYY for Unite API calls. */
export function toDdMmYyyy(input: string): string {
  const raw = String(input || '').trim().slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}-${m}-${y}`;
  }
  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) {
    const dd = String(asDate.getDate()).padStart(2, '0');
    const mm = String(asDate.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${asDate.getFullYear()}`;
  }
  return raw;
}

/** Shift an ISO date string by N days. */
export function shiftIsoDate(isoDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ── Time formatting ──────────────────────────────────────────────────────────

/** Normalize any time string to HH:mm (24h). Handles "HH:mm", "H:mm:ss", "hh:mm AM/PM". */
export function toHhMm24(input: any): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const meridiem = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)$/i);
  if (meridiem) {
    let hour = Number(meridiem[1]) % 12;
    if (meridiem[3].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(Number(meridiem[2])).padStart(2, '0')}`;
  }

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!hhmm) return '';
  return `${String(Number(hhmm[1])).padStart(2, '0')}:${String(Number(hhmm[2])).padStart(2, '0')}`;
}

/** Compute difference in minutes between two HH:mm strings. Returns 15 as default. */
export function minutesDiff(start: string, end: string): number {
  const s = toHhMm24(start).match(/^(\d{2}):(\d{2})$/);
  const e = toHhMm24(end).match(/^(\d{2}):(\d{2})$/);
  if (!s || !e) return 15;
  const diff = (Number(e[1]) * 60 + Number(e[2])) - (Number(s[1]) * 60 + Number(s[2]));
  return diff > 0 ? diff : 15;
}

/** Add minutes to an HH:mm string, wrapping at midnight. */
export function addMinutesToHhMm(startTime: string, minutesToAdd: number): string {
  const match = String(startTime || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return '';
  const total = Number(match[1]) * 60 + Number(match[2]) + Number(minutesToAdd || 0);
  if (!Number.isFinite(total)) return '';
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

// ── Phone formatting ─────────────────────────────────────────────────────────

/** Format phone for Unite API: "971-XXXXXXX". */
export function formatPhoneForUnite(input?: string | null): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return `971-${digits.slice(3)}`;
  if (digits.startsWith('0')) return `971-${digits.slice(1)}`;
  return digits;
}

/** Normalize phone to local digits only (strip country code) for matching. */
export function normalizePhoneDigits(input?: string | null): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ── Status normalization ─────────────────────────────────────────────────────

/**
 * Normalize Unite / local appointment status codes to a consistent lowercase value.
 * Unite codes: AAC, ACF, APH, YTC → confirmed; CVI → cancelled; NSW → no_show
 */
export function normalizeAppointmentStatus(value: any): string {
  const s = String(value || '').toLowerCase().trim();
  if (!s) return 'confirmed';
  if (s === 'cvi' || s === 'cancelled' || s === 'canceled' || s.includes('cancel')) return 'cancelled';
  if (s === 'nsw' || s.includes('no show') || s === 'no_show') return 'no_show';
  if (s === 'aac' || s === 'acf' || s === 'aph' || s === 'ytc' || s.includes('confirm') || s.includes('honour')) return 'confirmed';
  return s;
}

// ── Unite response extraction ────────────────────────────────────────────────

/** Case-insensitive field lookup on an object. */
export function getFieldCI(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const keyMap = new Map<string, string>();
  for (const key of Object.keys(obj)) keyMap.set(key.toLowerCase(), key);
  for (const key of keys) {
    const actual = keyMap.get(key.toLowerCase());
    if (actual !== undefined) return obj[actual];
  }
  return undefined;
}

/** Drill into common Unite response wrapper shapes to find the data payload. */
function uniteCandidates(payload: any): any[] {
  return [
    payload?.Data,
    payload?.data,
    payload?.uniteResponse?.Data,
    payload?.uniteResponse?.data,
    payload?.uniteResponse,
    payload,
  ].filter(Boolean);
}

/** Extract appointmentid + appointmentno from Unite response/raw data. */
export function extractUniteAppointmentRefs(payload: any): { appointmentid: string | null; appointmentno: string | null } {
  for (const obj of uniteCandidates(payload)) {
    const id = String(getFieldCI(obj, ['appointmentid', 'appointment_id']) ?? '').trim();
    if (id) {
      const no = String(getFieldCI(obj, ['appointmentno', 'appointment_no']) ?? '').trim();
      return { appointmentid: id, appointmentno: no || null };
    }
  }
  return { appointmentid: null, appointmentno: null };
}

/** Get the primary appointmentid from a Unite response. */
export function extractUniteAppointmentId(payload: any): string | null {
  const refs = extractUniteAppointmentRefs(payload);
  return refs.appointmentid || refs.appointmentno || null;
}

/** Extract appointment status code from a Unite response. */
export function extractUniteStatusCode(payload: any): string {
  for (const obj of uniteCandidates(payload)) {
    const code = String(
      getFieldCI(obj, ['appointmentstatus', 'status', 'statuscode', 'status_code']) ?? ''
    ).trim();
    if (code) return code;
  }
  return '';
}

/** Convert a raw Unite appointment ID to number (if purely numeric) or string. */
export function toUniteIdValue(input: string | number): string | number {
  const raw = String(input ?? '').trim();
  const numeric = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(numeric) ? numeric : raw;
}

// ── Unite date/time parsing ──────────────────────────────────────────────────

/**
 * Parse date, startTime, endTime from a Unite appointment object.
 * Handles various field naming conventions across Unite API versions.
 */
export function extractUniteStartDateTimeParts(ua: any): { date?: string; startTime?: string; endTime?: string } {
  const pickString = (keys: string[]): string => String(getFieldCI(ua, keys) ?? '').trim();
  const normDate = (v: string) => toIsoDate(v.replace(/\//g, '-'));

  const parseDuration = (): number | null => {
    const raw = pickString(['duration', 'appointmentduration', 'duration_minutes']);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const parseDateTime = (value: string): { date?: string; time?: string } => {
    const raw = value.trim();
    if (!raw) return {};
    const match = raw.match(/^(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})[ T]+(.+)$/);
    if (match) {
      const date = normDate(match[1]);
      const time = toHhMm24(match[2]);
      return {
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        time: time || undefined,
      };
    }
    const jsDate = new Date(raw);
    if (!Number.isNaN(jsDate.getTime())) {
      return {
        date: jsDate.toISOString().slice(0, 10),
        time: `${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`,
      };
    }
    return { time: toHhMm24(raw) || undefined };
  };

  const durationMinutes = parseDuration();

  // Try combined datetime fields first
  const startDT = pickString([
    'appointmentstarttime', 'appointment_start_time',
    'appointmentstartdatetime', 'appointment_start_datetime',
    'startdatetime', 'start_datetime', 'start_date_time',
  ]);
  const endDT = pickString([
    'appointmentendtime', 'appointment_end_time',
    'appointmentenddatetime', 'appointment_end_datetime',
    'enddatetime', 'end_datetime', 'end_date_time',
  ]);

  const parsedStart = parseDateTime(startDT);
  const parsedEnd = parseDateTime(endDT);

  if (parsedStart.date || parsedStart.time || parsedEnd.time) {
    return {
      date: parsedStart.date,
      startTime: parsedStart.time,
      endTime: parsedEnd.time || (parsedStart.time && durationMinutes ? addMinutesToHhMm(parsedStart.time, durationMinutes) : undefined),
    };
  }

  // Fallback: separate date + time fields
  const rawDate = pickString([
    'appointmentdate', 'appointment_date', 'date', 'startdate', 'start_date', 'appointment_start_date',
  ]);
  const rawTime = pickString([
    'starttime', 'start_time', 'appointmenttime', 'appointment_time', 'appointment_start_time', 'time',
  ]);
  const rawEndTime = pickString([
    'endtime', 'end_time', 'appointment_end_time', 'appointmenttotime',
  ]);

  const fallbackStart = rawTime ? (toHhMm24(rawTime) || undefined) : undefined;
  const fallbackEnd = rawEndTime ? (toHhMm24(rawEndTime) || undefined) : undefined;
  return {
    date: rawDate ? normDate(rawDate) : undefined,
    startTime: fallbackStart,
    endTime: fallbackEnd || (fallbackStart && durationMinutes ? addMinutesToHhMm(fallbackStart, durationMinutes) : undefined),
  };
}

// ── Patient name splitting ───────────────────────────────────────────────────

export function splitName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = String(fullName || 'Patient').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Patient',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : 'Patient',
  };
}

/** Convert gender string to Unite single-char code. */
export function toUniteGenderCode(gender?: string): string {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') return 'M';
  if (g === 'female') return 'F';
  return 'U';
}

/** Determine photo type for Unite based on identifier type. */
export function toUnitePhotoType(identifierType: string): string | undefined {
  if (identifierType === 'emirates_id') return 'EMIRATES_ID';
  if (identifierType === 'passport_number') return 'Passport';
  return undefined;
}

// ── Slot key for matching ────────────────────────────────────────────────────

export function slotKey(date?: string, startTime?: string, doctorId?: string): string {
  return `${String(date || '').trim()}|${toHhMm24(startTime)}|${String(doctorId || '').trim()}`;
}

// ── Unite array extraction ───────────────────────────────────────────────────

/** Extract an array from various Unite response shapes. */
export function toUniteArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ['appointments', 'data', 'Data', 'clinics', 'Clinics', 'doctors', 'Doctors']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

// ── Phone extraction from Unite appointment record ───────────────────────────

/** Extract and normalize phone from a Unite appointment record. */
export function extractUnitePhone(ua: any): string {
  const raw = String(
    ua?.patientmobilephone ?? ua?.patient_mobile_phone ??
    ua?.patientphone ?? ua?.patient_phone ??
    ua?.mobileno ?? ua?.mobile_no ??
    ua?.mobilenumber ?? ua?.mobile_number ??
    ua?.phonenumber ?? ua?.phone_number ??
    ua?.mobile ?? ua?.phone ?? ''
  ).replace(/\D/g, '');
  return normalizePhoneDigits(raw) || raw;
}

/** Extract doctor_id from a Unite appointment record. */
export function extractUniteDoctorId(ua: any): string {
  return String(ua?.doctor_id ?? ua?.doctorid ?? ua?.doctorId ?? '').trim();
}

/** Extract Unite appointment status from a raw record. */
export function extractUniteRecordStatus(ua: any): string {
  return String(
    getFieldCI(ua, [
      'status', 'appointmentstatus', 'statuscode', 'status_code',
      'statusdescription', 'status_description',
    ]) ?? ''
  );
}
