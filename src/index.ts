import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { scansRouter } from "./routes/scans";
import { openapiSpec } from "./openapi";

const app = express();
const PORT = process.env.PORT || 4000;

// Allow the frontend's origin to call this API, and parse incoming JSON bodies.
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Serve uploaded receipt/invoice files so previewUrl fields resolve to real images.
// e.g. previewUrl "/uploads/abc123.jpg" becomes http://localhost:4000/uploads/abc123.jpg
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Simple health check - visit this in a browser to confirm the server is running.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Root route - just so visiting the base URL in a browser doesn't show a confusing error.
app.get("/", (_req, res) => {
  res.json({ message: "Scanr API is running. Visit /api/docs for interactive docs." });
});

// Interactive API docs at /api/docs - visit this in a browser to see and try every endpoint.
// IMPORTANT: this must NOT be mounted at the bare "/api" path - doing so swallows every
// request under /api/* (including /api/auth, /api/scans, etc.) before they reach their
// real handlers. Keeping it at a distinct sub-path avoids that collision entirely.
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Mount route groups under /api.
// e.g. authRouter's "/signup" becomes "/api/auth/signup" here.
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/scans", scansRouter);

app.listen(PORT, () => {
  console.log(`Scanr backend running on http://localhost:${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/api/docs`);
});