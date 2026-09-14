import "dotenv/config";

import express from "express";
import cors from "cors";

import { askHrsyncAI } from "./services/aiEngine.js";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));


/* =========================================
   HEALTH CHECK
========================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "HRSYNC AI Backend",
    timestamp: new Date().toISOString(),
  });
});


/* =========================================
   AI ENDPOINT
========================================= */

app.post("/api/ai", async (req, res) => {
  try {
    const {
      message,
      context = {},
    } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        ok: false,
        message: "AI message is required.",
      });
    }

    const result = await askHrsyncAI({
      message: String(message).trim(),
      context,
    });

    return res.status(result.ok ? 200 : 500).json(result);

  } catch (error) {
    console.error("HRSYNC AI ERROR:", error);

    return res.status(500).json({
      ok: false,
      message: "HRSYNC AI server error.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});


/* =========================================
   404
========================================= */

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "HRSYNC backend route not found.",
  });
});


/* =========================================
   SERVER
========================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log("      HRSYNC AI BACKEND");
  console.log("====================================");
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log("====================================");
  console.log("");
});