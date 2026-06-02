// Centralised configuration, read once from the environment.
// Fails fast with a clear message when something required is missing.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Normalize APP_URL once: strip any trailing slash so derived URLs
// (e.g. the OAuth callback) never end up with a double slash, which would
// cause Google's redirect_uri_mismatch.
const appUrl = (process.env.APP_URL || "http://localhost:8080").replace(/\/+$/, "");

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl,

  databaseUrl: required("DATABASE_URL"),
  // Enable TLS to the database. Most managed Postgres services require it.
  // Set DATABASE_SSL=true (or "require") for those; leave unset for a local
  // container that speaks plain TCP.
  databaseSsl: ["true", "require", "1"].includes(
    (process.env.DATABASE_SSL || "").toLowerCase(),
  ),
  sessionSecret: required("SESSION_SECRET"),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    // nginx proxies /auth/* to this server, so the callback is on APP_URL.
    callbackUrl: `${appUrl}/auth/google/callback`,
  },

  llm: {
    apiKey: required("NVIDIA_API_KEY"),
    baseUrl: process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    model: process.env.LLM_MODEL || "minimaxai/minimax-m2.7",
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "8192", 10),
  },

  maxVisualizationsPerAccount: parseInt(
    process.env.MAX_VISUALIZATIONS_PER_ACCOUNT || "5",
    10,
  ),

  // Emails (comma-separated) that are automatically granted admin on login.
  // Used to bootstrap the first administrator; further admins can be promoted
  // from within the admin panel.
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};
