import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";

// Database imports
import { testConnection, pool } from "./config/database.js";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import clinicRoutes from "./routes/clinicRoutes.js";
import labRoutes from "./routes/labRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import medicalRecordRoutes from "./routes/medicalRecordRoutes.js";
import homeCareRoutes from "./routes/homeCareRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import emrRoutes from "./routes/emrRoutes.js";
import faceVitalsRoutes from "./routes/faceVitalsRoutes.js";
import uniteAppointmentRoutes from "./routes/uniteAppointmentRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// ======================
// Global Middleware
// ======================
app.use(helmet());

const defaultDevOrigins = ["http://localhost:3000", "http://localhost:5173"];
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...defaultDevOrigins, ...envOrigins])
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ======================
// Health Check Routes
// ======================
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    service: "Smart Care Polyclinic API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ======================
// API Routes
// ======================
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/catalog", clinicRoutes);
app.use("/api/labs", labRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/records", medicalRecordRoutes);
app.use("/api/home-care", homeCareRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/user", userRoutes);
app.use("/api/emr", emrRoutes);
app.use("/api", faceVitalsRoutes);
app.use("/api/unite-appointments", uniteAppointmentRoutes);
app.use("/api/payments", paymentRoutes);

// ======================
// Error Handling Middleware
// ======================
app.use(notFoundHandler);
app.use(errorHandler);

// ======================
// Start Server Function
// ======================


export default app;

if (process.env.NODE_ENV !== "production") {
async function start() {
  try {
    console.log("🔄 Testing database connection...");
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.warn("⚠️ Database not connected - server will run in limited mode");
    } else {
      console.log("✅ Database connected successfully to AWS RDS");
    }

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
start().catch(console.error);
}