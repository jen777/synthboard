// Account levels (membership tiers). Each level grants a visualization quota
// that an admin can retune live through the `level_N_limit` settings. The level
// names and the mapping to setting keys are fixed here and shared by the quota
// checks, the admin panel, and the top-bar badge.
//
// Kept dependency-free on purpose: `settings.js` imports `LEVELS` while building
// its schema, so importing settings back here would create a cycle. Callers that
// need a live limit read it via `getSetting(level.settingKey)` (see
// `resolveLevel` in settings.js).

export const LEVELS = [
  {
    level: 1,
    name: "Sketcher",
    settingKey: "level_1_limit",
    defaultLimit: 5,
    charsKey: "level_1_chars",
    defaultChars: 7000,
    // Back-compat: the old single-value envs still seed Level 1 so existing
    // deployments keep their configured values.
    env: "MAX_VISUALIZATIONS_PER_ACCOUNT",
    charsEnv: "MAX_SOURCE_CHARS",
  },
  {
    level: 2,
    name: "Creator",
    settingKey: "level_2_limit",
    defaultLimit: 20,
    charsKey: "level_2_chars",
    defaultChars: 8500,
  },
  {
    level: 3,
    name: "Architect",
    settingKey: "level_3_limit",
    defaultLimit: 50,
    charsKey: "level_3_chars",
    defaultChars: 10000,
  },
  {
    level: 4,
    name: "Visionary",
    settingKey: "level_4_limit",
    defaultLimit: 150,
    charsKey: "level_4_chars",
    defaultChars: 15000,
  },
];

export const DEFAULT_LEVEL = 1;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = LEVELS.length;

// Find a level definition by number, falling back to the default level for any
// unknown/legacy value so callers always get a usable tier.
export function levelByNumber(level) {
  return LEVELS.find((l) => l.level === Number(level)) || LEVELS[0];
}

export function isValidLevel(level) {
  const n = Number(level);
  return Number.isInteger(n) && n >= MIN_LEVEL && n <= MAX_LEVEL;
}
