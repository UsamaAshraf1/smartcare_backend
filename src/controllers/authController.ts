import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  loginEmailSchema, loginOtpRequestSchema, loginOtpVerifySchema, registerSchema
} from '../middleware/validators.js';

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { code: string; expires: number }>();

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, emirates_id, passport_number, role, auth_method)
       VALUES ($1, $2, $3, $4, $5, $6, 'patient', 'email')
       RETURNING id, name, email, phone, emirates_id, passport_number, role, emr_id, created_at`,
      [data.name, data.email, passwordHash, data.phone, data.emiratesId || null, data.passportNumber || null]
    );

    const user = result.rows[0];
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({ token, user });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new AppError('Email or government ID already registered', 409));
    } else {
      next(error);
    }
  }
}

export async function loginEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginEmailSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, name, email, phone, emirates_id, passport_number, emr_id, password_hash, role, photo_url, preferences FROM users WHERE email = $1 AND is_active = true',
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    next(error);
  }
}

export async function requestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginOtpRequestSchema.parse(req.body);
    const cleanPhone = data.phone.replace(/\s/g, '');

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(cleanPhone, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 min

    // In production: send via Twilio
    // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilio.messages.create({ body: `Your Smart Care code: ${code}`, from: process.env.TWILIO_PHONE_NUMBER, to: cleanPhone });

    console.log(`📱 OTP for ${cleanPhone}: ${code}`); // Dev only

    const payload: any = { message: 'OTP sent successfully', expiresIn: 300 };
    if (process.env.NODE_ENV !== 'production') {
      payload.devOtp = code;
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginOtpVerifySchema.parse(req.body);
    const cleanPhone = data.phone.replace(/\s/g, '');

    const stored = otpStore.get(cleanPhone);
    if (!stored || stored.code !== data.code || Date.now() > stored.expires) {
      throw new AppError('Invalid or expired OTP', 401);
    }

    otpStore.delete(cleanPhone);

    // Find or create user by phone
    let result = await pool.query(
      `SELECT id, name, email, phone, emirates_id, passport_number, emr_id, role, photo_url, preferences
       FROM users
       WHERE regexp_replace(COALESCE(phone, ''), '\\s+', '', 'g') = $1`,
      [cleanPhone]
    );

    if (result.rows.length === 0) {
      // Auto-register
      result = await pool.query(
        `INSERT INTO users (name, phone, role, auth_method)
         VALUES ('New Patient', $1, 'patient', 'otp')
         RETURNING id, name, email, phone, emirates_id, passport_number, emr_id, role, photo_url, preferences`,
        [cleanPhone]
      );
    }

    const user = result.rows[0];
    await pool.query('UPDATE users SET last_login_at = NOW(), auth_method = $2 WHERE id = $1', [user.id, 'otp']);

    const token = generateToken({ userId: user.id, email: user.email || '', role: user.role });
    res.json({ token, user });
  } catch (error) {
    next(error);
  }
}

export async function loginUaePass(req: Request, res: Response, next: NextFunction) {
  try {
    // UAE Pass OAuth flow — redirect to UAE Pass authorization URL
    const clientId = process.env.UAEPASS_CLIENT_ID;
    const redirectUri = process.env.UAEPASS_REDIRECT_URI;
    const authUrl = `https://id.uaepass.ae/idshub/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=urn:uae:digitalid:profile:general&acr_values=urn:safelayer:tws:policies:authentication:level:low`;

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
}

export async function uaePassCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.query;

    if (!code) {
      throw new AppError('Authorization code missing', 400);
    }

    // In production: exchange code for token with UAE Pass API
    // const tokenResponse = await fetch('https://id.uaepass.ae/idshub/token', { ... });
    // const profileResponse = await fetch('https://id.uaepass.ae/idshub/userinfo', { ... });

    // Demo: simulate UAE Pass profile
    const uaePassProfile = {
      emiratesId: '784-1992-1234567-1',
      name: 'Shamas',
      email: 'shamas@uaepass.ae',
    };

    let result = await pool.query(
      'SELECT id, name, email, phone, emirates_id, passport_number, emr_id, role, photo_url, preferences FROM users WHERE emirates_id = $1',
      [uaePassProfile.emiratesId]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO users (emirates_id, name, email, role, auth_method)
         VALUES ($1, $2, $3, 'patient', 'uaepass')
         RETURNING id, name, email, phone, emirates_id, passport_number, emr_id, role, photo_url, preferences`,
        [uaePassProfile.emiratesId, uaePassProfile.name, uaePassProfile.email]
      );
    }

    const user = result.rows[0];
    await pool.query('UPDATE users SET last_login_at = NOW(), uae_pass_token = $2 WHERE id = $1', [user.id, code]);

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    // Redirect back to frontend with token
    res.redirect(`${process.env.CORS_ORIGIN}/#/auth/callback?token=${token}`);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, emirates_id, passport_number, emr_id, role, photo_url, date_of_birth,
              gender, blood_type, emergency_contact, preferences, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
