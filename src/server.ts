// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import dotenv from 'dotenv';
// import { createServer } from 'http';
// import { testConnection } from './config/database.js';
// import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
// import { initWebSocket } from './services/websocket.js';

// import authRoutes from './routes/authRoutes.js';
// import appointmentRoutes from './routes/appointmentRoutes.js';
// import clinicRoutes from './routes/clinicRoutes.js';
// import labRoutes from './routes/labRoutes.js';
// import orderRoutes from './routes/orderRoutes.js';
// import medicalRecordRoutes from './routes/medicalRecordRoutes.js';
// import homeCareRoutes from './routes/homeCareRoutes.js';
// import aiRoutes from './routes/aiRoutes.js';
// import userRoutes from './routes/userRoutes.js';
// import emrRoutes from './routes/emrRoutes.js';
// import faceVitalsRoutes from './routes/faceVitalsRoutes.js';
// import uniteAppointmentRoutes from './routes/uniteAppointmentRoutes.js';
// import paymentRoutes from './routes/paymentRoutes.js';

// dotenv.config();

// const app = express();
// const httpServer = createServer(app);
// const PORT = process.env.PORT || 4000;

// // Global Middleware
// app.use(helmet());
// const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:5173'];
// const envOrigins = (process.env.CORS_ORIGIN || '')
//   .split(',')
//   .map((o) => o.trim())
//   .filter(Boolean);
// const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...envOrigins]));

// app.use(cors({
//   origin: allowedOrigins,
//   credentials: true,
// }));
// app.use(morgan('dev'));
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true }));

// // Health Check
// const healthHandler = (_req: express.Request, res: express.Response) => {
//   res.json({
//     status: 'ok',
//     service: 'Smart Care Polyclinic API',
//     version: '1.0.0',
//     timestamp: new Date().toISOString(),
//   });
// };

// app.get('/health', healthHandler);
// app.get('/api/health', healthHandler);

// // API Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/appointments', appointmentRoutes);
// app.use('/api/catalog', clinicRoutes);
// app.use('/api/labs', labRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/records', medicalRecordRoutes);
// app.use('/api/home-care', homeCareRoutes);
// app.use('/api/ai', aiRoutes);
// app.use('/api/user', userRoutes);
// app.use('/api/emr', emrRoutes);
// app.use('/api', faceVitalsRoutes);
// app.use('/api/unite-appointments', uniteAppointmentRoutes);
// app.use('/api/payments', paymentRoutes);

// // Serve React build in production
// if (process.env.NODE_ENV === 'production') {
//   const path = await import('path');
//   const __dirname = path.dirname(new URL(import.meta.url).pathname);
//   const staticPath = path.join(__dirname, '../../frontend/dist');
//   app.use(express.static(staticPath));
//   app.get('*', (_req, res) => {
//     res.sendFile(path.join(staticPath, 'index.html'));
//   });
// }

// // Error Handling
// app.use(notFoundHandler);
// app.use(errorHandler);

// // Start
// async function start() {
//   const dbConnected = await testConnection();
//   if (!dbConnected) {
//     console.warn('Database not connected - running in limited mode');
//   }

//   initWebSocket(httpServer);

//   httpServer.listen(PORT, () => {
//     console.log(`Smart Care API running on http://localhost:${PORT}`);
//     console.log(`WebSocket available on ws://localhost:${PORT}/ws`);
//     console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
//   });
// }

// start().catch(console.error);

// export default app;



import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { testConnection } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// ❌ REMOVE WebSocket import
// import { initWebSocket } from './services/websocket.js';

import authRoutes from './routes/authRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import labRoutes from './routes/labRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import medicalRecordRoutes from './routes/medicalRecordRoutes.js';
import homeCareRoutes from './routes/homeCareRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import userRoutes from './routes/userRoutes.js';
import emrRoutes from './routes/emrRoutes.js';
import faceVitalsRoutes from './routes/faceVitalsRoutes.js';
import uniteAppointmentRoutes from './routes/uniteAppointmentRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

dotenv.config();

const app = express();

// ✅ Run DB check once (no server start)
// testConnection().then((connected) => {
//   if (!connected) {
//     console.warn('Database not connected');
//   } else {
//     console.log('✅ Database connected');
//   }
// });
if (process.env.NODE_ENV !== 'production') {
  testConnection().then((connected) => {
    console.log("DB status:", connected);
  }).catch(console.error);
}

// Global Middleware
app.use(helmet());

const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...envOrigins]));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'Smart Care Polyclinic API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/catalog', clinicRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/records', medicalRecordRoutes);
app.use('/api/home-care', homeCareRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/emr', emrRoutes);
app.use('/api', faceVitalsRoutes);
app.use('/api/unite-appointments', uniteAppointmentRoutes);
app.use('/api/payments', paymentRoutes);

// ❌ REMOVE React static serving (not needed on Vercel backend)
// Vercel frontend handles this separately

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// ✅ IMPORTANT: export app ONLY (NO listen)
export default app;