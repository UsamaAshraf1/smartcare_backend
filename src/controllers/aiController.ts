import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiAssessmentSchema } from '../middleware/validators.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// Gemini AI integration (server-side — API key is safe here)
async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError('AI service not configured', 503);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
  } catch (error: any) {
    console.error('Gemini API error:', error.message);
    throw new AppError('AI analysis failed. Please try again.', 502);
  }
}

const SYSTEM_INSTRUCTION = `You are a professional, empathetic clinical AI advisor for Smart Care Polyclinic in Dubai. 
Use clinical formatting but friendly tone. Structure your response with clear sections.
Always emphasize this is NOT medical advice and recommend seeing a clinic doctor for diagnosis.
Format with markdown headings and bullet points for readability.`;

export async function runEMRAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    // Fetch patient's medical records
    const records = await pool.query(
      'SELECT * FROM medical_records WHERE patient_id = $1 AND is_active = true',
      [req.user!.userId]
    );

    if (records.rows.length === 0) {
      throw new AppError('No medical records found for assessment', 404);
    }

    // Build context from records
    const meds = records.rows.filter((r: any) => r.record_type === 'medication').map((r: any) => r.data);
    const labs = records.rows.filter((r: any) => r.record_type === 'lab_result').map((r: any) => r.data);
    const vitals = records.rows.filter((r: any) => r.record_type === 'vital').map((r: any) => r.data);
    const diagnoses = records.rows.filter((r: any) => r.record_type === 'diagnosis').map((r: any) => r.data);

    const prompt = `Generate a 'General Wellbeing & Health Assessment' for a patient with the following EMR data:
    - Medications: ${JSON.stringify(meds)}
    - Lab Results: ${JSON.stringify(labs)}
    - Recent Vitals: ${JSON.stringify(vitals)}
    - Diagnoses: ${JSON.stringify(diagnoses)}
    Provide actionable tips for nutrition, lifestyle, and include a 'Safety Escalation' section if any values are concerning.`;

    const result = await callGemini(prompt, SYSTEM_INSTRUCTION);

    // Save assessment
    await pool.query(
      `INSERT INTO ai_assessments (patient_id, assessment_type, input_data, result, model)
       VALUES ($1, 'emr', $2, $3, 'gemini-2.0-flash')`,
      [req.user!.userId, JSON.stringify({ meds, labs, vitals, diagnoses }), result]
    );

    res.json({ assessment: result, type: 'emr' });
  } catch (error) {
    next(error);
  }
}

export async function runDocumentAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const { documentText } = req.body;

    if (!documentText) {
      throw new AppError('Document text is required', 400);
    }

    const prompt = `Analyze this medical document and provide a patient-friendly summary with key findings, 
    recommended actions, and any values that need attention:\n\n${documentText}`;

    const result = await callGemini(prompt, SYSTEM_INSTRUCTION);

    await pool.query(
      `INSERT INTO ai_assessments (patient_id, assessment_type, input_data, result, model)
       VALUES ($1, 'document', $2, $3, 'gemini-2.0-flash')`,
      [req.user!.userId, JSON.stringify({ documentLength: documentText.length }), result]
    );

    res.json({ assessment: result, type: 'document' });
  } catch (error) {
    next(error);
  }
}

export async function runVitalsAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const { heartRate, bloodPressure, spO2, respiratoryRate, stressLevel } = req.body;

    const prompt = `Analyze these real-time vitals captured via the patient's camera:
    - Heart Rate: ${heartRate} bpm
    - Blood Pressure: ${bloodPressure}
    - SpO2: ${spO2}%
    - Respiratory Rate: ${respiratoryRate} breaths/min
    - Stress Level: ${stressLevel}
    Provide an immediate assessment and whether the patient should seek urgent care.`;

    const result = await callGemini(prompt, SYSTEM_INSTRUCTION);

    await pool.query(
      `INSERT INTO ai_assessments (patient_id, assessment_type, input_data, result, model)
       VALUES ($1, 'vitals', $2, $3, 'gemini-2.0-flash')`,
      [req.user!.userId, JSON.stringify({ heartRate, bloodPressure, spO2, respiratoryRate, stressLevel }), result]
    );

    res.json({ assessment: result, type: 'vitals' });
  } catch (error) {
    next(error);
  }
}

export async function getAssessmentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT id, assessment_type, created_at FROM ai_assessments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getAssessmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_assessments WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Assessment not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
