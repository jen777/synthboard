import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import morgan from "morgan";

import { config } from "./config.js";
import { pool, initSchema } from "./db.js";
import { initSettings } from "./services/settings.js";
import passport from "./auth/passport.js";
import authRoutes from "./auth/routes.js";
import userRoutes from "./routes/user.js";
import visualizationRoutes from "./routes/visualizations.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// Behind the nginx reverse proxy — needed for secure cookies in production.
app.set("trust proxy", 1);

app.use(morgan(config.env === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));

// In production the SPA is same-origin (served + proxied by nginx), so CORS is
// only really needed for local Vite dev on a different port.
app.use(
  cors({
    origin: config.appUrl,
    credentials: true,
  }),
);

const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env === "production" && config.appUrl.startsWith("https"),
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Never let the browser cache API responses. Without this, Express's ETag makes
// /api/user/me return 304 and the SPA reads a stale (logged-out) auth state.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/visualizations", visualizationRoutes);
app.use("/api/admin", adminRoutes);

// Centralised error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

async function start() {
  await initSchema();
  await initSettings();
  app.listen(config.port, () => {
    console.log(`SynthBoard API listening on :${config.port}`);
    console.log(`APP_URL: ${config.appUrl}`);
    console.log(
      `Google OAuth callback (must match an Authorized redirect URI): ${config.google.callbackUrl}`,
    );
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
