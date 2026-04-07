// ===============================================================
// FaceVitals Controller -- Upvio AI face scan endpoints
// Flow: get scan link → user opens link → poll for results
// ===============================================================

import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import {
  listVitalsLinks,
  getVitalsLink,
  listScans,
  getScan,
  listTemplates,
  getTemplate,
  getScanUrl,
  formatMetrics,
  VitalsScan,
  VitalsLinkStatus,
} from '../services/upvioVitals.js';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readLinkStatus(value: unknown): VitalsLinkStatus | undefined {
  const status = readString(value);
  if (!status) return undefined;
  if (status === 'ACTIVE' || status === 'ARCHIVED' || status === 'DISABLED') {
    return status;
  }
  return undefined;
}

/**
 * GET /api/facevitals/tokens
 * Return the user's remaining face vitals token balance
 */
export async function getTokenBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT face_vitals_tokens FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ tokens: result.rows[0].face_vitals_tokens });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/facevitals/scan-link
 * Returns the URL of an active VitalsLink for the user to open and perform a scan.
 * Also deducts 1 token from the user's balance.
 */
export async function getScanLink(req: Request, res: Response, next: NextFunction) {
  try {
    // Check token balance
    const userResult = await pool.query(
      'SELECT face_vitals_tokens FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    const tokens = userResult.rows[0].face_vitals_tokens;
    if (tokens <= 0) {
      res.status(402).json({
        status: 'error',
        message: 'No face vitals tokens remaining. Please purchase a token pack.',
        tokens: 0,
      });
      return;
    }

    // Find an active vitals link
    const linksResponse = await listVitalsLinks({ status: 'ACTIVE', limit: 1 });
    const links = linksResponse.data || [];

    if (links.length === 0) {
      res.status(503).json({
        status: 'error',
        message: 'No active vitals scan link is available. Please contact support.',
      });
      return;
    }

    const link = links[0];

    // Check if link has reached max scans
    if (link.maxScans !== null && link.scansCount >= link.maxScans) {
      res.status(503).json({
        status: 'error',
        message: 'Scan link has reached its maximum usage. Please contact support.',
      });
      return;
    }

    // Deduct 1 token
    const updated = await pool.query(
      'UPDATE users SET face_vitals_tokens = face_vitals_tokens - 1, updated_at = NOW() WHERE id = $1 RETURNING face_vitals_tokens',
      [req.user!.userId]
    );

    const scanUrl = getScanUrl(link.slug);

    res.json({
      status: 'success',
      scanUrl,
      linkId: link.id,
      linkSlug: link.slug,
      remainingTokens: updated.rows[0].face_vitals_tokens,
    });
  } catch (error: any) {
    console.error('[FaceVitals] Get scan link error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/facevitals/scans/poll
 * Poll for the latest completed scan for a given vitalsLinkId.
 * Query params: ?linkId=xxx
 * Returns the most recent SUCCEEDED scan, or a pending status.
 */
export async function pollScanResults(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = req.query.linkId as string;
    if (!linkId) {
      res.status(400).json({ status: 'error', message: 'linkId query parameter is required' });
      return;
    }

    const scansResponse = await listScans({ vitalsLinkId: linkId, limit: 5 });
    const scans = scansResponse.data || [];

    // Find the most recent succeeded scan
    const succeeded = scans.find((s: VitalsScan) => s.status === 'SUCCEEDED' && s.results?.metrics);

    if (!succeeded) {
      // Check if any are still in progress
      const inProgress = scans.find((s: VitalsScan) => s.status === 'PENDING' || s.status === 'STARTED');
      res.json({
        status: inProgress ? 'scanning' : 'no_results',
        message: inProgress
          ? 'Scan is in progress. Please wait...'
          : 'No completed scan found. Please complete the scan via the link.',
      });
      return;
    }

    const formatted = succeeded.results?.metrics ? formatMetrics(succeeded.results.metrics) : null;

    res.json({
      status: 'success',
      data: {
        ...succeeded,
        formattedMetrics: formatted,
      },
    });
  } catch (error: any) {
    console.error('[FaceVitals] Poll scan results error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/facevitals/scans/:scanId
 * Get scan details and results
 */
export async function getFaceScan(req: Request, res: Response, next: NextFunction) {
  try {
    const scanId = String(req.params.scanId);
    const response = await getScan(scanId);
    const scan = response.data;

    const formatted = scan.results?.metrics ? formatMetrics(scan.results.metrics) : null;

    res.json({
      status: 'success',
      data: {
        ...scan,
        formattedMetrics: formatted,
      },
    });
  } catch (error: any) {
    console.error('[FaceVitals] Get scan error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/facevitals/scans
 * List all scans
 */
export async function listFaceScans(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = req.query.linkId as string | undefined;
    const scansResponse = await listScans({
      vitalsLinkId: linkId,
      limit: 50,
    });

    res.json({
      status: 'success',
      count: scansResponse.data.length,
      totalCount: scansResponse.meta.totalCount,
      data: scansResponse.data,
    });
  } catch (error: any) {
    console.error('[FaceVitals] List scans error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/facevitals/scans/:scanId/results
 * Get only the formatted results of a completed scan
 */
export async function getFaceScanResults(req: Request, res: Response, next: NextFunction) {
  try {
    const scanId = String(req.params.scanId);
    const response = await getScan(scanId);
    const scan = response.data;

    if (!scan.results) {
      res.status(404).json({
        status: 'pending',
        message: 'Scan results not yet available. The scan may still be processing.',
        scanStatus: scan.status,
      });
      return;
    }

    const formatted = formatMetrics(scan.results.metrics);

    res.json({
      status: 'success',
      data: {
        scanId: scan.id,
        scanStatus: scan.status,
        rawMetrics: scan.results.metrics,
        formatted,
      },
    });
  } catch (error: any) {
    console.error('[FaceVitals] Results error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/links
 */
export async function listBusinessVitalsLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const response = await listVitalsLinks({
      limit: readNumber(req.query.limit),
      offset: readNumber(req.query.offset),
      status: readLinkStatus(req.query.status),
      vitalsTemplateId: readString(req.query.vitalsTemplateId),
    }, businessId);

    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] List business links error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/links/:id
 */
export async function getBusinessVitalsLink(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const linkId = String(req.params.id);
    const response = await getVitalsLink(linkId, businessId);
    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] Get business link error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/scans
 */
export async function listBusinessVitalsScans(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const response = await listScans({
      limit: readNumber(req.query.limit),
      offset: readNumber(req.query.offset),
      patientId: readString(req.query.patientId),
      vitalsLinkId: readString(req.query.vitalsLinkId),
    }, businessId);

    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] List business scans error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/scans/:id
 */
export async function getBusinessVitalsScan(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const scanId = String(req.params.id);
    const response = await getScan(scanId, businessId);
    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] Get business scan error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/templates
 */
export async function listBusinessVitalsTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const response = await listTemplates(businessId);
    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] List business templates error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/businesses/:businessId/vitals/templates/:id
 */
export async function getBusinessVitalsTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const templateId = String(req.params.id);
    const response = await getTemplate(templateId, businessId);
    res.json(response);
  } catch (error: any) {
    console.error('[FaceVitals] Get business template error:', error.message);
    res.status(502).json({ status: 'error', message: error.message });
  }
}
