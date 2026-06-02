// Runtime application settings, editable from the admin panel.
//
// Values live in the `app_settings` table and are cached in memory. On boot we
// seed any missing keys from environment defaults, so a fresh deployment behaves
// exactly like before the admin panel existed. The LLM service and quota checks
// read from here instead of static config, so an admin can retune them live.
import { query } from "../db.js";

// Schema for every editable setting: type, env-var default source, fallback,
// and (for numbers) a sane range. `label`/`group` drive the admin UI.
export const SETTINGS_SCHEMA = {
  llm_model: {
    type: "string",
    env: "LLM_MODEL",
    default: "minimaxai/minimax-m2.7",
    group: "model",
    label: "Model",
    help: "OpenAI-compatible model id served by the configured endpoint.",
  },
  llm_base_url: {
    type: "string",
    env: "LLM_BASE_URL",
    default: "https://integrate.api.nvidia.com/v1",
    group: "model",
    label: "Base URL",
    help: "OpenAI-compatible API endpoint. The API key stays server-side (env).",
  },
  llm_max_tokens: {
    type: "int",
    env: "LLM_MAX_TOKENS",
    default: 8192,
    min: 256,
    max: 32768,
    group: "model",
    label: "Max tokens",
    help: "Maximum tokens generated per diagram.",
  },
  llm_temperature: {
    type: "float",
    env: "LLM_TEMPERATURE",
    default: 1,
    min: 0,
    max: 2,
    group: "model",
    label: "Temperature",
    help: "Sampling temperature (0–2).",
  },
  llm_top_p: {
    type: "float",
    env: "LLM_TOP_P",
    default: 0.95,
    min: 0,
    max: 1,
    group: "model",
    label: "Top P",
    help: "Nucleus sampling probability (0–1).",
  },
  max_visualizations_per_account: {
    type: "int",
    env: "MAX_VISUALIZATIONS_PER_ACCOUNT",
    default: 5,
    min: 1,
    max: 100000,
    group: "limits",
    label: "Visualizations per account",
    help: "Maximum diagrams a single account may generate.",
  },
};

const cache = new Map();

function defaultFor(key) {
  const def = SETTINGS_SCHEMA[key];
  const envVal = def.env ? process.env[def.env] : undefined;
  return coerce(key, envVal !== undefined && envVal !== "" ? envVal : def.default);
}

// Coerce a raw value to the setting's type, clamping numbers to their range.
// Throws on values that can't be parsed, so the API can reject bad input.
export function coerce(key, raw) {
  const def = SETTINGS_SCHEMA[key];
  if (!def) throw new Error(`Unknown setting: ${key}`);

  if (def.type === "string") {
    const s = String(raw ?? "").trim();
    if (!s) throw new Error(`${key} must not be empty`);
    return s;
  }

  const num = def.type === "int" ? parseInt(raw, 10) : parseFloat(raw);
  if (Number.isNaN(num)) throw new Error(`${key} must be a number`);
  if (def.min !== undefined && num < def.min) {
    throw new Error(`${key} must be ≥ ${def.min}`);
  }
  if (def.max !== undefined && num > def.max) {
    throw new Error(`${key} must be ≤ ${def.max}`);
  }
  return num;
}

// Load all settings into the cache, seeding any missing keys with defaults.
export async function initSettings() {
  const { rows } = await query("SELECT key, value FROM app_settings");
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  for (const key of Object.keys(SETTINGS_SCHEMA)) {
    if (stored.has(key)) {
      try {
        cache.set(key, coerce(key, stored.get(key)));
        continue;
      } catch {
        // Fall through to default if a stored value is somehow invalid.
      }
    }
    const value = defaultFor(key);
    cache.set(key, value);
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, String(value)],
    );
  }
}

export function getSetting(key) {
  return cache.get(key);
}

export function getAllSettings() {
  return Object.fromEntries(cache);
}

// Validate + persist a patch of settings, then refresh the cache.
export async function updateSettings(patch) {
  const entries = Object.entries(patch).filter(([k]) => k in SETTINGS_SCHEMA);
  if (entries.length === 0) throw new Error("No valid settings provided");

  const coerced = entries.map(([k, v]) => [k, coerce(k, v)]);

  for (const [key, value] of coerced) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()`,
      [key, String(value)],
    );
    cache.set(key, value);
  }
  return getAllSettings();
}
