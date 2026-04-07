// ═══════════════════════════════════════════════════════════
// EMR Controller — Proxies Unite EMR data to frontend
// ═══════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { getMedicalRecords, getRecentRecords, formatDateForUnite, transformPatientData } from '../services/uniteEmr.js';

/**
 * GET /api/emr/records?from=dd-MM-yyyy&to=dd-MM-yyyy
 * Fetch medical records from Unite EMR for a date range
 */
export async function getEmrRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, days } = req.query;

    let records;

    if (from && to) {
      // Use explicit date range
      const raw = await getMedicalRecords(from as string, to as string);
      records = (raw || []).map(transformPatientData);
    } else {
      // Default: last N days (default 30)
      const numDays = days ? parseInt(days as string, 10) : 30;
      records = await getRecentRecords(numDays);
    }

    res.json({
      status: 'success',
      count: records.length,
      data: records,
    });
  } catch (error: any) {
    console.error('[EMR Controller] Error:', error.message);
    res.status(502).json({
      status: 'error',
      message: 'Failed to fetch records from EMR system',
      detail: error.message,
    });
  }
}

/**
 * GET /api/emr/records/patient/:patientPin
 * Fetch records for a specific patient from Unite EMR
 */
export async function getEmrPatientRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const allRecords = await getRecentRecords(days);
    const patientRecords = allRecords.filter((r: any) => r.patientPin === patientPin);

    if (patientRecords.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No records found for this patient',
      });
    }

    res.json({
      status: 'success',
      data: patientRecords[0], // Single patient with all visits
    });
  } catch (error: any) {
    console.error('[EMR Controller] Error:', error.message);
    res.status(502).json({
      status: 'error',
      message: 'Failed to fetch patient records from EMR',
      detail: error.message,
    });
  }
}

/**
 * GET /api/emr/allergies/:patientPin
 * Get allergies for a specific patient
 */
export async function getEmrAllergies(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const allRecords = await getRecentRecords(30);
    const patient = allRecords.find((r: any) => r.patientPin === patientPin);

    res.json({
      status: 'success',
      data: patient?.allergies || [],
    });
  } catch (error: any) {
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/emr/visits/:patientPin
 * Get visit history for a specific patient
 */
export async function getEmrVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const allRecords = await getRecentRecords(days);
    const patient = allRecords.find((r: any) => r.patientPin === patientPin);

    res.json({
      status: 'success',
      data: patient?.visits || [],
    });
  } catch (error: any) {
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/emr/medications/:patientPin
 * Get all medications across visits for a patient
 */
export async function getEmrMedications(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const allRecords = await getRecentRecords(30);
    const patient = allRecords.find((r: any) => r.patientPin === patientPin);

    // Flatten medications from all visits
    const medications = (patient?.visits || []).flatMap((v: any) =>
      v.medications.map((m: any) => ({
        ...m,
        visitDate: v.date,
        doctor: v.doctor,
        clinic: v.clinic,
      }))
    );

    res.json({
      status: 'success',
      data: medications,
    });
  } catch (error: any) {
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/emr/vitals/:patientPin
 * Get all vitals across visits for a patient
 */
export async function getEmrVitals(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const allRecords = await getRecentRecords(30);
    const patient = allRecords.find((r: any) => r.patientPin === patientPin);

    // Flatten vitals from all visits with visit context
    const vitals = (patient?.visits || []).flatMap((v: any) =>
      v.vitals.map((vital: any) => ({
        ...vital,
        visitDate: v.date,
        doctor: v.doctor,
        clinic: v.clinic,
      }))
    );

    res.json({
      status: 'success',
      data: vitals,
    });
  } catch (error: any) {
    res.status(502).json({ status: 'error', message: error.message });
  }
}

/**
 * GET /api/emr/diagnoses/:patientPin
 * Get all diagnoses across visits for a patient
 */
export async function getEmrDiagnoses(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientPin } = req.params;
    const allRecords = await getRecentRecords(30);
    const patient = allRecords.find((r: any) => r.patientPin === patientPin);

    const diagnoses = (patient?.visits || []).flatMap((v: any) =>
      v.diagnoses.map((d: any) => ({
        ...d,
        visitDate: v.date,
        doctor: v.doctor,
      }))
    );

    res.json({
      status: 'success',
      data: diagnoses,
    });
  } catch (error: any) {
    res.status(502).json({ status: 'error', message: error.message });
  }
}
