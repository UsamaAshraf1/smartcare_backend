// ═══════════════════════════════════════════════════════════
// Unite EMR Integration Service
// Connects to Unite+ Medical Records API
// Docs: Unite_Medical_Records_Integration_API v0.0.1
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

function requireUniteEnv(primaryKey: string, fallbackKey: string): string {
  const value = process.env[primaryKey] || process.env[fallbackKey];
  if (!value) {
    throw new Error(
      `[Unite EMR] Missing required env var: ${primaryKey} (or fallback ${fallbackKey})`
    );
  }
  return value;
}

const UNITE_BASE_URL =
  process.env.UNITE_EMR_BASE_URL ||
  process.env.UNITE_APPOINTMENT_BASE_URL;
if (!UNITE_BASE_URL) {
  throw new Error(
    '[Unite EMR] Missing required env var: UNITE_EMR_BASE_URL (or fallback UNITE_APPOINTMENT_BASE_URL)'
  );
}

const UNITE_APP_ID = requireUniteEnv('UNITE_EMR_APP_ID', 'UNITE_APPOINTMENT_APP_ID');
const UNITE_APP_KEY = requireUniteEnv('UNITE_EMR_APP_KEY', 'UNITE_APPOINTMENT_APP_KEY');
const UNITE_INITIAL_TOKEN = requireUniteEnv('UNITE_EMR_TOKEN', 'UNITE_APPOINTMENT_TOKEN');

interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;       // minutes
  refresh_token: string;
  obtained_at: number;      // timestamp ms
}

let cachedToken: TokenData | null = null;

// ─── Token Management ─────────────────────────────────────

/**
 * Get a valid access token. Automatically refreshes if expired.
 */
async function getAccessToken(): Promise<string> {
  // If we have a cached token and it's not expired (with 5-min buffer)
  if (cachedToken) {
    const expiresAt = cachedToken.obtained_at + (cachedToken.expires_in * 60 * 1000);
    const bufferMs = 5 * 60 * 1000; // 5 min buffer
    if (Date.now() < expiresAt - bufferMs) {
      return cachedToken.access_token;
    }
    // Token expired — try refresh
    console.log('[Unite EMR] Token expired, refreshing...');
    try {
      return await refreshToken();
    } catch (err) {
      console.error('[Unite EMR] Refresh failed, getting new token:', err);
    }
  }

  // No cached token or refresh failed — authorize fresh
  return await authorize();
}

/**
 * Authorize with Unite EMR to get initial access token.
 * GET /gateway/authorize?app_id={app_id}&app_key={app_key}
 * Headers: Authorization: Bearer {initial_token}
 */
async function authorize(): Promise<string> {
  console.log('[Unite EMR] Requesting new access token...');

  const url = `${UNITE_BASE_URL}/gateway/authorize?app_id=${encodeURIComponent(UNITE_APP_ID)}&app_key=${encodeURIComponent(UNITE_APP_KEY)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNITE_INITIAL_TOKEN}`,
    },
  });

  const data = await response.json();

  if (data.Status !== 'Success') {
    throw new Error(`Unite EMR auth failed: ${data.Message || 'Unknown error'}`);
  }

  cachedToken = {
    access_token: data.Data.access_token,
    token_type: data.Data.token_type,
    expires_in: data.Data.expires_in,
    refresh_token: data.Data.refresh_token,
    obtained_at: Date.now(),
  };

  console.log(`[Unite EMR] Token obtained, expires in ${data.Data.expires_in} minutes`);
  return cachedToken.access_token;
}

/**
 * Refresh an expired token.
 * POST /gateway/RefreshToken
 * Headers: Authorization: Bearer {refresh_token}
 * Body: { app_id, app_key, token: expired_access_token }
 */
async function refreshToken(): Promise<string> {
  if (!cachedToken) throw new Error('No token to refresh');

  const url = `${UNITE_BASE_URL}/gateway/RefreshToken`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cachedToken.refresh_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: UNITE_APP_ID,
      app_key: UNITE_APP_KEY,
      token: cachedToken.access_token,
    }),
  });

  const data = await response.json();

  if (data.Status !== 'Success') {
    cachedToken = null; // Clear so next call does fresh auth
    throw new Error(`Unite EMR token refresh failed: ${data.Message || 'Unknown error'}`);
  }

  cachedToken = {
    access_token: data.Data.access_token,
    token_type: data.Data.token_type,
    expires_in: data.Data.expires_in,
    refresh_token: data.Data.refresh_token,
    obtained_at: Date.now(),
  };

  console.log('[Unite EMR] Token refreshed successfully');
  return cachedToken.access_token;
}

// ─── API Methods ──────────────────────────────────────────

/**
 * Fetch medical records for a date range (max 30 days).
 * POST /gateway/GetMedicalRecordsDetails
 * Body: { from_date: "dd-MM-yyyy", to_date: "dd-MM-yyyy" }
 *
 * Returns patient data with allergies, visit details (vitals, diagnosis, medication, items, notes)
 */
export async function getMedicalRecords(fromDate: string, toDate: string) {
  const token = await getAccessToken();

  const url = `${UNITE_BASE_URL}/gateway/GetMedicalRecordsDetails`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from_date: fromDate,
      to_date: toDate,
    }),
  });

  const data = await response.json();

  if (data.MessageStatus !== 'Success') {
    throw new Error(`Unite EMR fetch failed: ${data.DetailMessage || 'Unknown error'}`);
  }

  return data.Data;
}

// ─── Data Transformation Helpers ──────────────────────────
// These transform Unite EMR response format into our app's format

export interface TransformedPatient {
  patientPin: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  nationality: string;
  dateOfBirth: string;
  city: string;
  emiratesId: string;
  emiratesIdType: string;
  allergies: TransformedAllergy[];
  visits: TransformedVisit[];
}

export interface TransformedAllergy {
  type: string;
  severity: string;
  notes: string;
  reaction: string;
  recordedAt: string;
}

export interface TransformedVisit {
  date: string;
  doctor: string;
  createdBy: string;
  clinic: string;
  department: string;
  isFollowUp: boolean;
  vitals: Record<string, string>[];
  diagnoses: { type: string; code: string; description: string }[];
  medications: {
    code: string;
    name: string;
    dosageDays: string;
    quantity: string;
    instructions: string;
  }[];
  items: Record<string, { code: string; description: string }[]>;
  notes: Record<string, string>;
}

/**
 * Transform raw Unite EMR patient data into our app's format
 */
export function transformPatientData(rawPatient: any): TransformedPatient {
  return {
    patientPin: rawPatient.patientpin?.trim() || '',
    name: rawPatient.patientname || '',
    phone: rawPatient.mobilephone?.trim() || '',
    email: rawPatient.mailid || '',
    gender: rawPatient.gender === 'M' ? 'male' : rawPatient.gender === 'F' ? 'female' : 'unknown',
    nationality: rawPatient.nationality || '',
    dateOfBirth: rawPatient.dateofbirth || '',
    city: rawPatient.city || '',
    emiratesId: rawPatient.photoid || '',
    emiratesIdType: rawPatient.photoIdtype || '',

    allergies: (rawPatient.allergy || []).map((a: any) => ({
      type: a.type || '',
      severity: a.severity || '',
      notes: a.notes || '',
      reaction: a.adversereaction || '',
      recordedAt: a.recordeddatetime || '',
    })),

    visits: (rawPatient.visitdetails || []).map((v: any) => ({
      date: v.visitdate || '',
      doctor: v.doctorname || '',
      createdBy: v.visitcreatedby || '',
      clinic: v.clinicname || '',
      department: v.department || '',
      isFollowUp: v.followupvisit === 'Yes',

      vitals: v.vitals || [],

      diagnoses: (v.diagnosis || []).map((d: any) => ({
        type: d.type || '',
        code: d.code || '',
        description: d.description || '',
      })),

      medications: (v.medication || []).map((m: any) => ({
        code: m.localcode || '',
        name: m.name || '',
        dosageDays: m.dosagedays || '',
        quantity: m.totalquantity || '',
        instructions: m.roadescription || '',
      })),

      items: Object.entries(v.items || {}).reduce((acc: any, [key, val]: [string, any]) => {
        acc[key] = (val || []).map((item: any) => ({
          code: item.code || '',
          description: item.description || '',
        }));
        return acc;
      }, {}),

      notes: v.notes || {},
    })),
  };
}

/**
 * Helper: Get date string in dd-MM-yyyy format (Unite EMR format)
 */
export function formatDateForUnite(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Convenience: Fetch records for the last N days
 */
export async function getRecentRecords(days: number = 30) {
  const safeDays = Math.max(1, Math.min(Number(days) || 30, 30));
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - safeDays);

  const raw = await getMedicalRecords(
    formatDateForUnite(fromDate),
    formatDateForUnite(toDate)
  );

  return (raw || []).map(transformPatientData);
}

export default {
  getMedicalRecords,
  getRecentRecords,
  transformPatientData,
  formatDateForUnite,
};
