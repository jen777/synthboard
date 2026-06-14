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
    // Fallback cap on source characters fed to the model; the live value is the
    // admin-editable `max_source_chars` setting. Source text beyond this is
    // truncated so input token usage stays bounded.
    maxSourceChars: parseInt(process.env.MAX_SOURCE_CHARS || "7000", 10),
    // Abort an upstream call that runs longer than this so we log a clear
    // timeout instead of hanging until the reverse proxy returns a 504. Keep it
    // just under the proxy read timeout (nginx is 300s here).
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "280000", 10),
    // Retries are off by default: retrying a slow reasoning model just burns
    // another full timeout window without helping.
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "0", 10),
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
