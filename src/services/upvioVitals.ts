// ══════════════════════════════════════════════════════════
// Upvio AI FaceVitals Integration Service
// API: https://api.upvio.com/v1
// All endpoints: GET-only under /businesses/{businessId}/vitals/...
// ══════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

const UPVIO_BASE_URL = (process.env.UPVIO_BASE_URL || 'https://api.upvio.com/v1').replace(/\/$/, '');
const UPVIO_API_KEY = process.env.UPVIO_API_KEY || 'e83a719c175f8c0a2f6a808241ee3e1a300084111e6229f8b875ea4b3d2c14d854f01f76c126794df429a9bb893859965e4b42474e0dc9cd29da6018b2812bd2';
const UPVIO_BUSINESS_ID = process.env.UPVIO_BUSINESS_ID || 'cmlroznww2ttk01jwfccd5shk';
const UPVIO_SCAN_BASE_URL = (process.env.UPVIO_SCAN_BASE_URL || 'https://scan.upvio.com/smart-care-clinic/links').replace(/\/$/, '');

function getHeaders() {
  if (!UPVIO_API_KEY) {
    throw new Error('UPVIO_API_KEY is not configured in backend environment');
  }
  if (!UPVIO_BUSINESS_ID) {
    throw new Error('UPVIO_BUSINESS_ID is not configured in backend environment');
  }

  return {
    'Authorization': `Bearer ${UPVIO_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function resolveBusinessId(businessIdOverride?: string): string {
  const businessId = businessIdOverride || UPVIO_BUSINESS_ID;
  if (!businessId) {
    throw new Error('UPVIO_BUSINESS_ID is not configured');
  }
  return businessId;
}

function businessUrl(path: string, businessIdOverride?: string): string {
  const businessId = resolveBusinessId(businessIdOverride);
  return `${UPVIO_BASE_URL}/businesses/${businessId}${path}`;
}

async function parseUpvioError(response: Response, operation: string, businessIdOverride?: string): Promise<never> {
  const err = await response.json().catch(() => ({ error: 'Unknown error' }));
  const businessId = resolveBusinessId(businessIdOverride);
  const title = err?.error?.title || err?.message || '';
  if (response.status === 400 && title === 'Business ID does not match API key') {
    throw new Error(
      `Upvio ${operation} failed (${response.status}): Business ID "${businessId}" does not match the configured API key. ` +
      'Set matching UPVIO_API_KEY and UPVIO_BUSINESS_ID values.'
    );
  }
  throw new Error(`Upvio ${operation} failed (${response.status}): ${JSON.stringify(err)}`);
}

// ─── Types ────────────────────────────────────────────────

export type VitalsLinkStatus = 'ACTIVE' | 'ARCHIVED' | 'DISABLED';
export type VitalsScanStatus = 'PENDING' | 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'ABORTED';

export interface VitalsLink {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: VitalsLinkStatus;
  vitalsTemplateId: string;
  scansCount: number;
  maxScans: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VitalsScanMetrics {
  heartRate: number | null;
  heartRateVariability: number | null;
  breathingRate: number | null;
  stressIndex: number | null;
  parasympatheticActivity: number | null;
  cardiacWorkload: number | null;
  bloodPressureDiastolic: number | null;
  bloodPressureSystolic: number | null;
  bmiClassification: number | null;
  wellnessScore: number | null;
  vascularAge: number | null;
  atheroscleroticCvdRisk: number | null;
  cardiovascularEventRisk: number | null;
  cardiovascularRiskScore: number | null;
  hypertensionRisk: number | null;
  diabetesRisk: number | null;
  fattyLiverDiseaseRisk: number | null;
  waistToHeightRatio: number | null;
  bodyFatPercentage: number | null;
  bodyRoundnessIndex: number | null;
  aBodyShapeIndex: number | null;
  conicityIndex: number | null;
  basalMetabolicRate: number | null;
  totalDailyEnergyExpenditure: number | null;
}

export interface VitalsScanResults {
  metrics: VitalsScanMetrics;
}

export interface VitalsScan {
  id: string;
  patientId: string;
  vitalsLinkId: string;
  status: VitalsScanStatus;
  results: VitalsScanResults | null;
  includedMetrics: string[];
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VitalsTemplate {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  metrics: string[];
  linksCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API Methods ──────────────────────────────────────────

export async function listVitalsLinks(params?: {
  limit?: number;
  offset?: number;
  status?: VitalsLinkStatus;
  vitalsTemplateId?: string;
}, businessId?: string): Promise<{ data: VitalsLink[]; meta: { totalCount: number } }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.status) query.set('status', params.status);
  if (params?.vitalsTemplateId) query.set('vitalsTemplateId', params.vitalsTemplateId);

  const qs = query.toString();
  const url = businessUrl(`/vitals/links${qs ? `?${qs}` : ''}`, businessId);

  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'list links', businessId);
  }
  return response.json();
}

export async function getVitalsLink(linkId: string, businessId?: string): Promise<{ data: VitalsLink }> {
  const url = businessUrl(`/vitals/links/${linkId}`, businessId);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'get link', businessId);
  }
  return response.json();
}

export async function listScans(params?: {
  limit?: number;
  offset?: number;
  patientId?: string;
  vitalsLinkId?: string;
}, businessId?: string): Promise<{ data: VitalsScan[]; meta: { totalCount: number } }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.patientId) query.set('patientId', params.patientId);
  if (params?.vitalsLinkId) query.set('vitalsLinkId', params.vitalsLinkId);

  const qs = query.toString();
  const url = businessUrl(`/vitals/scans${qs ? `?${qs}` : ''}`, businessId);

  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'list scans', businessId);
  }
  return response.json();
}

export async function getScan(scanId: string, businessId?: string): Promise<{ data: VitalsScan }> {
  const url = businessUrl(`/vitals/scans/${scanId}`, businessId);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'get scan', businessId);
  }
  return response.json();
}

export async function listTemplates(businessId?: string): Promise<{ data: VitalsTemplate[]; meta: { totalCount: number } }> {
  const url = businessUrl('/vitals/templates', businessId);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'list templates', businessId);
  }
  return response.json();
}

export async function getTemplate(templateId: string, businessId?: string): Promise<{ data: VitalsTemplate }> {
  const url = businessUrl(`/vitals/templates/${templateId}`, businessId);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseUpvioError(response, 'get template', businessId);
  }
  return response.json();
}

// ─── Helpers ──────────────────────────────────────────────

export function getScanUrl(slug: string): string {
  return `${UPVIO_SCAN_BASE_URL}/${slug}`;
}

export function formatMetrics(metrics: VitalsScanMetrics) {
  return {
    vitals: {
      heartRate: metrics.heartRate ? `${Math.round(metrics.heartRate)} bpm` : null,
      heartRateVariability: metrics.heartRateVariability ? `${Math.round(metrics.heartRateVariability)} ms` : null,
      breathingRate: metrics.breathingRate ? `${Math.round(metrics.breathingRate)} bpm` : null,
      bloodPressure: (metrics.bloodPressureSystolic && metrics.bloodPressureDiastolic)
        ? `${Math.round(metrics.bloodPressureSystolic)}/${Math.round(metrics.bloodPressureDiastolic)} mmHg` : null,
      stressIndex: metrics.stressIndex ? `${Math.round(metrics.stressIndex)}` : null,
    },
    wellness: {
      wellnessScore: metrics.wellnessScore ? `${Math.round(metrics.wellnessScore)}/100` : null,
      vascularAge: metrics.vascularAge ? `${Math.round(metrics.vascularAge)} years` : null,
      cardiacWorkload: metrics.cardiacWorkload ? `${Math.round(metrics.cardiacWorkload)}` : null,
    },
    risks: {
      cardiovascularRisk: metrics.cardiovascularRiskScore ? `${(metrics.cardiovascularRiskScore * 100).toFixed(1)}%` : null,
      hypertensionRisk: metrics.hypertensionRisk ? `${(metrics.hypertensionRisk * 100).toFixed(1)}%` : null,
      diabetesRisk: metrics.diabetesRisk ? `${(metrics.diabetesRisk * 100).toFixed(1)}%` : null,
      fattyLiverRisk: metrics.fattyLiverDiseaseRisk ? `${(metrics.fattyLiverDiseaseRisk * 100).toFixed(1)}%` : null,
    },
    body: {
      bodyFatPercentage: metrics.bodyFatPercentage ? `${metrics.bodyFatPercentage.toFixed(1)}%` : null,
      bmiClassification: metrics.bmiClassification ? `${metrics.bmiClassification.toFixed(1)}` : null,
      basalMetabolicRate: metrics.basalMetabolicRate ? `${Math.round(metrics.basalMetabolicRate)} kcal` : null,
    },
  };
}

export default {
  listVitalsLinks,
  getVitalsLink,
  listScans,
  getScan,
  listTemplates,
  getTemplate,
  getScanUrl,
  formatMetrics,
};
