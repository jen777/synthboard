import { config } from "../config.js";
import { pool, query } from "../db.js";
import { isValidLevel } from "./levels.js";

const API_KEY_ENV_RE = /^[A-Z_][A-Z0-9_]*$/;
const INIT_MARKER = "llm_catalog_initialized";

export class LlmCatalogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LlmCatalogError";
    this.status = status;
  }
}

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new LlmCatalogError(`${label} is required`);
  return text;
}

function catalogId(value, label) {
  const id = String(value ?? "");
  if (!/^\d+$/.test(id)) {
    throw new LlmCatalogError(`${label} must be a valid id`);
  }
  return id;
}

function booleanValue(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new LlmCatalogError("Boolean fields must be true or false");
  }
  return value;
}

function numberValue(value, label, { min, max, integer = false }) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new LlmCatalogError(`${label} must be a number`);
  }
  if (integer && !Number.isInteger(number)) {
    throw new LlmCatalogError(`${label} must be an integer`);
  }
  if (number < min || number > max) {
    throw new LlmCatalogError(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

function safeNumber(value, fallback, options) {
  try {
    return numberValue(value, "Value", options);
  } catch {
    return fallback;
  }
}

export function validateProviderFields(input, existing = {}) {
  const name = requiredText(input.name ?? existing.name, "Provider name");
  const baseUrl = requiredText(input.baseUrl ?? existing.base_url, "Base URL");
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new LlmCatalogError("Base URL must be a valid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new LlmCatalogError("Base URL must use http or https");
  }

  const apiKeyEnv = requiredText(
    input.apiKeyEnv ?? existing.api_key_env,
    "API key environment variable",
  );
  if (!API_KEY_ENV_RE.test(apiKeyEnv)) {
    throw new LlmCatalogError(
      "API key environment variable must contain only uppercase letters, numbers, and underscores",
    );
  }

  return {
    name,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKeyEnv,
    enabled: booleanValue(input.enabled, existing.enabled ?? true),
  };
}

export function validateModelFields(input, existing = {}) {
  const providerId = requiredText(
    input.providerId ?? existing.provider_id,
    "Provider",
  );
  if (!/^\d+$/.test(providerId)) {
    throw new LlmCatalogError("Provider must be a valid provider id");
  }

  const modelName = requiredText(
    input.modelName ?? existing.model_name,
    "Model name",
  );
  const displayName =
    String(input.displayName ?? existing.display_name ?? "").trim() || modelName;
  const minLevel = numberValue(
    input.minLevel ?? existing.min_level ?? 1,
    "Minimum level",
    { min: 1, max: 4, integer: true },
  );
  if (!isValidLevel(minLevel)) {
    throw new LlmCatalogError("Minimum level is not a configured account level");
  }

  const enabled = booleanValue(input.enabled, existing.enabled ?? true);
  const isDefault = booleanValue(
    input.isDefault,
    existing.is_default ?? false,
  );
  if (isDefault && !enabled) {
    throw new LlmCatalogError("The default model must be enabled");
  }

  return {
    providerId,
    modelName,
    displayName,
    minLevel,
    enabled,
    isDefault,
    maxTokens: numberValue(
      input.maxTokens ?? existing.max_tokens ?? config.llm.maxTokens,
      "Max tokens",
      { min: 256, max: 32768, integer: true },
    ),
    temperature: numberValue(
      input.temperature ??
        existing.temperature ??
        config.llm.temperature,
      "Temperature",
      { min: 0, max: 2 },
    ),
    topP: numberValue(
      input.topP ?? existing.top_p ?? config.llm.topP,
      "Top P",
      { min: 0, max: 1 },
    ),
  };
}

export function providerHasApiKey(provider) {
  return Boolean(String(process.env[provider.api_key_env] || "").trim());
}

export function isModelAllowedForLevel(model, level) {
  return Number(level) >= Number(model.min_level);
}

function publicModel(row) {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    providerName: row.provider_name,
    modelName: row.model_name,
    displayName: row.display_name,
    minLevel: Number(row.min_level),
    isDefault: Boolean(row.is_default),
    maxTokens: Number(row.max_tokens),
    temperature: Number(row.temperature),
    topP: Number(row.top_p),
  };
}

async function runtimeRows(level) {
  const { rows } = await query(
    `SELECT m.*, p.name AS provider_name, p.base_url, p.api_key_env
       FROM llm_models m
       JOIN llm_providers p ON p.id = m.provider_id
      WHERE m.enabled = true
        AND p.enabled = true
        AND m.min_level <= $1
      ORDER BY m.is_default DESC, m.min_level DESC,
               p.name ASC, m.display_name ASC`,
    [Number(level)],
  );
  return rows.filter(providerHasApiKey);
}

export async function listAvailableModels(level) {
  const rows = await runtimeRows(level);
  const models = rows.map(publicModel);
  return {
    models,
    defaultModelId: models[0]?.id || null,
  };
}

export async function resolveModelForLevel(modelId, level) {
  const rows = await runtimeRows(level);
  if (rows.length === 0) {
    throw new LlmCatalogError(
      "No AI model is configured for your account level. Contact an administrator.",
      503,
    );
  }

  let row;
  if (modelId === undefined || modelId === null || modelId === "") {
    row = rows[0];
  } else {
    const id = String(modelId);
    if (!/^\d+$/.test(id)) {
      throw new LlmCatalogError("Invalid model selection");
    }
    row = rows.find((candidate) => String(candidate.id) === id);
    if (!row) {
      throw new LlmCatalogError(
        "This model is unavailable for your account level.",
        403,
      );
    }
  }

  return {
    ...publicModel(row),
    provider: {
      id: String(row.provider_id),
      name: row.provider_name,
      baseUrl: row.base_url,
      apiKeyEnv: row.api_key_env,
      apiKey: process.env[row.api_key_env],
    },
  };
}

export async function listAdminCatalog() {
  const [providersResult, modelsResult] = await Promise.all([
    query(
      `SELECT id, name, base_url, api_key_env, enabled, created_at, updated_at
         FROM llm_providers
        ORDER BY name, id`,
    ),
    query(
      `SELECT m.*, p.name AS provider_name
         FROM llm_models m
         JOIN llm_providers p ON p.id = m.provider_id
        ORDER BY p.name, m.min_level, m.display_name`,
    ),
  ]);

  const modelsByProvider = new Map();
  for (const row of modelsResult.rows) {
    const key = String(row.provider_id);
    const models = modelsByProvider.get(key) || [];
    models.push({
      ...publicModel(row),
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    modelsByProvider.set(key, models);
  }

  return providersResult.rows.map((provider) => ({
    id: String(provider.id),
    name: provider.name,
    baseUrl: provider.base_url,
    apiKeyEnv: provider.api_key_env,
    hasApiKey: providerHasApiKey(provider),
    enabled: provider.enabled,
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
    models: modelsByProvider.get(String(provider.id)) || [],
  }));
}

export async function createProvider(input) {
  const value = validateProviderFields(input);
  const { rows } = await query(
    `INSERT INTO llm_providers (name, base_url, api_key_env, enabled)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [value.name, value.baseUrl, value.apiKeyEnv, value.enabled],
  );
  return rows[0];
}

export async function updateProvider(id, input) {
  const providerId = catalogId(id, "Provider");
  const current = await query("SELECT * FROM llm_providers WHERE id = $1", [
    providerId,
  ]);
  if (!current.rows[0]) throw new LlmCatalogError("Provider not found", 404);
  const value = validateProviderFields(input, current.rows[0]);
  const { rows } = await query(
    `UPDATE llm_providers
        SET name = $1, base_url = $2, api_key_env = $3, enabled = $4,
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [value.name, value.baseUrl, value.apiKeyEnv, value.enabled, providerId],
  );
  return rows[0];
}

async function assignFallbackDefault(client) {
  await client.query(
    `UPDATE llm_models
        SET is_default = true, updated_at = now()
      WHERE id = (
        SELECT m.id
          FROM llm_models m
          JOIN llm_providers p ON p.id = m.provider_id
         WHERE m.enabled = true AND p.enabled = true
         ORDER BY m.min_level, m.created_at
         LIMIT 1
      )
        AND NOT EXISTS (SELECT 1 FROM llm_models WHERE is_default)`,
  );
}

export async function deleteProvider(id) {
  const providerId = catalogId(id, "Provider");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "DELETE FROM llm_providers WHERE id = $1",
      [providerId],
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      throw new LlmCatalogError("Provider not found", 404);
    }
    await assignFallbackDefault(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function writeModel(input, existing) {
  const value = validateModelFields(input, existing);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (value.isDefault) {
      await client.query("UPDATE llm_models SET is_default = false WHERE is_default");
    }

    let result;
    if (existing) {
      result = await client.query(
        `UPDATE llm_models
            SET provider_id = $1, model_name = $2, display_name = $3,
                min_level = $4, enabled = $5, is_default = $6,
                max_tokens = $7, temperature = $8, top_p = $9,
                updated_at = now()
          WHERE id = $10
          RETURNING *`,
        [
          value.providerId,
          value.modelName,
          value.displayName,
          value.minLevel,
          value.enabled,
          value.isDefault,
          value.maxTokens,
          value.temperature,
          value.topP,
          existing.id,
        ],
      );
    } else {
      result = await client.query(
        `INSERT INTO llm_models
           (provider_id, model_name, display_name, min_level, enabled,
            is_default, max_tokens, temperature, top_p)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          value.providerId,
          value.modelName,
          value.displayName,
          value.minLevel,
          value.enabled,
          value.isDefault,
          value.maxTokens,
          value.temperature,
          value.topP,
        ],
      );
    }
    await assignFallbackDefault(client);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23503") {
      throw new LlmCatalogError("Provider not found", 404);
    }
    if (error.code === "23505") {
      throw new LlmCatalogError(
        "That provider already has a model with this model name",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createModel(input) {
  return writeModel(input, null);
}

export async function updateModel(id, input) {
  const modelId = catalogId(id, "Model");
  const current = await query("SELECT * FROM llm_models WHERE id = $1", [modelId]);
  if (!current.rows[0]) throw new LlmCatalogError("Model not found", 404);
  return writeModel(input, current.rows[0]);
}

export async function deleteModel(id) {
  const modelId = catalogId(id, "Model");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deleted = await client.query(
      "DELETE FROM llm_models WHERE id = $1 RETURNING is_default",
      [modelId],
    );
    if (!deleted.rows[0]) {
      await client.query("ROLLBACK");
      throw new LlmCatalogError("Model not found", 404);
    }
    if (deleted.rows[0].is_default) {
      await assignFallbackDefault(client);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// One-time migration from the former single-model settings into the catalog.
// A marker prevents an intentionally emptied catalog from being re-seeded.
export async function initLlmCatalog() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const marker = await client.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, 'true', now())
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [INIT_MARKER],
    );
    if (marker.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    const existing = await client.query("SELECT COUNT(*)::int AS count FROM llm_models");
    if (existing.rows[0].count === 0) {
      const legacy = await client.query(
        `SELECT key, value FROM app_settings
          WHERE key IN (
            'llm_model', 'llm_base_url', 'llm_max_tokens',
            'llm_temperature', 'llm_top_p'
          )`,
      );
      const legacySettings = Object.fromEntries(
        legacy.rows.map((row) => [row.key, row.value]),
      );
      const baseUrl = legacySettings.llm_base_url || config.llm.baseUrl;
      const modelName = legacySettings.llm_model || config.llm.model;
      const maxTokens = safeNumber(
        legacySettings.llm_max_tokens,
        config.llm.maxTokens,
        { min: 256, max: 32768, integer: true },
      );
      const temperature = safeNumber(
        legacySettings.llm_temperature,
        config.llm.temperature,
        { min: 0, max: 2 },
      );
      const topP = safeNumber(legacySettings.llm_top_p, config.llm.topP, {
        min: 0,
        max: 1,
      });
      const provider = await client.query(
        `INSERT INTO llm_providers (name, base_url, api_key_env, enabled)
         VALUES ('NVIDIA', $1, $2, true)
         RETURNING id`,
        [baseUrl, config.llm.legacyApiKeyEnv],
      );
      await client.query(
        `INSERT INTO llm_models
           (provider_id, model_name, display_name, min_level, enabled,
            is_default, max_tokens, temperature, top_p)
         VALUES ($1,$2,$2,1,true,true,$3,$4,$5)`,
        [
          provider.rows[0].id,
          modelName,
          maxTokens,
          temperature,
          topP,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
