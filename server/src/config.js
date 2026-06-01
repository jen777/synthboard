// Centralised configuration, read once from the environment.
// Fails fast with a clear message when something required is missing.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl: process.env.APP_URL || "http://localhost:8080",

  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    // nginx proxies /auth/* to this server, so the callback is on APP_URL.
    callbackUrl: `${process.env.APP_URL || "http://localhost:8080"}/auth/google/callback`,
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
};
