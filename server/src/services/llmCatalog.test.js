import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.TEST_PROVIDER_API_KEY = "secret-value";

const {
  isModelAllowedForLevel,
  providerHasApiKey,
  validateModelFields,
  validateProviderFields,
} = await import("./llmCatalog.js");

test("provider configuration stores an env-var name rather than a key value", () => {
  const provider = validateProviderFields({
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/",
    apiKeyEnv: "TEST_PROVIDER_API_KEY",
    enabled: true,
  });

  assert.deepEqual(provider, {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "TEST_PROVIDER_API_KEY",
    enabled: true,
  });
  assert.equal(providerHasApiKey({ api_key_env: provider.apiKeyEnv }), true);
  assert.equal(providerHasApiKey({ api_key_env: "MISSING_PROVIDER_KEY" }), false);
});

test("provider configuration rejects secret-looking values in the env field", () => {
  assert.throws(
    () =>
      validateProviderFields({
        name: "Unsafe",
        baseUrl: "https://example.com/v1",
        apiKeyEnv: "sk-live-secret",
      }),
    /environment variable must contain only uppercase letters/,
  );
});

test("model configuration validates level access and generation parameters", () => {
  const model = validateModelFields({
    providerId: "7",
    modelName: "gpt-example",
    displayName: "GPT Example",
    minLevel: 3,
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    temperature: 0.4,
    topP: 0.9,
  });

  assert.equal(model.minLevel, 3);
  assert.equal(isModelAllowedForLevel({ min_level: 3 }, 2), false);
  assert.equal(isModelAllowedForLevel({ min_level: 3 }, 3), true);
  assert.equal(isModelAllowedForLevel({ min_level: 3 }, 4), true);
});

test("model configuration supports create flow with no existing row", () => {
  const model = validateModelFields(
    {
      providerId: "7",
      modelName: "gpt-example",
      minLevel: 1,
      maxTokens: 4096,
      temperature: 0.4,
      topP: 0.9,
    },
    null,
  );

  assert.equal(model.enabled, true);
  assert.equal(model.isDefault, false);
});

test("model configuration rejects blank numeric fields", () => {
  assert.throws(
    () =>
      validateModelFields({
        providerId: "7",
        modelName: "gpt-example",
        minLevel: 1,
        maxTokens: 4096,
        temperature: "",
        topP: 0.9,
      }),
    /Temperature must be a number/,
  );
});

test("model configuration rejects fractional account levels", () => {
  assert.throws(
    () =>
      validateModelFields({
        providerId: "7",
        modelName: "gpt-example",
        minLevel: 2.5,
        maxTokens: 4096,
        temperature: 0.4,
        topP: 0.9,
      }),
    /Minimum level must be an integer/,
  );
});

test("a disabled model cannot remain the catalog default", () => {
  assert.throws(
    () =>
      validateModelFields({
        providerId: "7",
        modelName: "gpt-example",
        minLevel: 1,
        enabled: false,
        isDefault: true,
        maxTokens: 4096,
        temperature: 0.4,
        topP: 0.9,
      }),
    /default model must be enabled/i,
  );
});
