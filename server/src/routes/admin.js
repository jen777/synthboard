import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { query } from "../db.js";
import {
  SETTINGS_SCHEMA,
  getAllSettings,
  updateSettings,
  resolveLevel,
} from "../services/settings.js";
import { LEVELS, isValidLevel } from "../services/levels.js";
import {
  deleteIconLibrary,
  getIconObjectPreview,
  ingestDrawioLibrary,
  listIconLibraries,
  listIconObjects,
  searchIconObjects,
} from "../services/drawioLibraries.js";
import {
  createModel,
  createProvider,
  deleteModel,
  deleteProvider,
  listAdminCatalog,
  updateModel,
  updateProvider,
} from "../services/llmCatalog.js";

const router = Router();
const MAX_ICON_LIBRARY_BYTES = 10 * 1024 * 1024;

// Every route here requires an authenticated admin.
router.use(requireAdmin);

// ── Usage statistics ──────────────────────────────────────────
router.get("/stats", async (req, res, next) => {
  try {
    const [totals, byPreset, recent, topUsers] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM users) AS users,
           (SELECT COUNT(*)::int FROM users WHERE is_admin) AS admins,
           (SELECT COUNT(*)::int FROM visualizations) AS visualizations,
           (SELECT COUNT(*)::int FROM visualizations
              WHERE created_at > now() - interval '7 days') AS last7days`,
      ),
      query(
        `SELECT preset, COUNT(*)::int AS count
           FROM visualizations
          GROUP BY preset
          ORDER BY count DESC`,
      ),
      query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count
           FROM visualizations
          WHERE created_at > now() - interval '14 days'
          GROUP BY day
          ORDER BY day`,
      ),
      query(
        `SELECT u.id, u.email, u.name, COUNT(v.id)::int AS count
           FROM users u
           LEFT JOIN visualizations v ON v.user_id = u.id
          GROUP BY u.id
          ORDER BY count DESC, u.created_at ASC
          LIMIT 10`,
      ),
    ]);

    res.json({
      totals: totals.rows[0],
      byPreset: byPreset.rows,
      daily: recent.rows,
      topUsers: topUsers.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── Diagram generation report ─────────────────────────────────
// Telemetry captured per generation: timing, output size, token usage and
// other LLM metadata. Returns headline aggregates plus the most recent rows.
router.get("/generations", async (req, res, next) => {
  try {
    const [totals, byModel, byPresetIcons, recent] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int                                  AS total,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'failed')::int    AS failed,
           COALESCE(SUM(prompt_tokens), 0)::bigint         AS input_tokens,
           COALESCE(SUM(completion_tokens), 0)::bigint     AS output_tokens,
           COALESCE(SUM(total_tokens), 0)::bigint          AS total_tokens,
           ROUND(AVG(total_tokens))::int                   AS avg_total_tokens,
           ROUND(AVG(generation_ms))::int                  AS avg_generation_ms,
           ROUND(AVG(first_token_ms))::int                 AS avg_first_token_ms,
           ROUND(AVG(diagram_bytes))::int                  AS avg_diagram_bytes,
           COALESCE(SUM(diagram_bytes), 0)::bigint         AS total_diagram_bytes,
           COUNT(*) FILTER (
             WHERE jsonb_array_length(COALESCE(meta->'iconCandidates', '[]'::jsonb)) > 0
           )::int                                          AS icon_candidate_generations,
           COUNT(*) FILTER (
             WHERE jsonb_array_length(COALESCE(meta->'iconsApplied', '[]'::jsonb)) > 0
           )::int                                          AS icon_applied_generations,
           COUNT(*) FILTER (
             WHERE jsonb_array_length(COALESCE(meta->'iconsMissing', '[]'::jsonb)) > 0
           )::int                                          AS icon_missing_generations,
           COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconCandidates', '[]'::jsonb))), 0)::bigint
                                                             AS icon_candidates_total,
           COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconsApplied', '[]'::jsonb))), 0)::bigint
                                                             AS icons_applied_total,
           COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconsAutoApplied', '[]'::jsonb))), 0)::bigint
                                                             AS icons_auto_applied_total,
           COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconsMissing', '[]'::jsonb))), 0)::bigint
                                                             AS icons_missing_total,
           COALESCE(SUM(COALESCE((meta->>'iconAutoEligible')::int, 0)), 0)::bigint
                                                             AS icon_auto_eligible_total,
           COALESCE(SUM(COALESCE((meta->>'iconAutoTarget')::int, 0)), 0)::bigint
                                                             AS icon_auto_target_total,
           COALESCE(SUM(COALESCE((meta->>'iconAutoCandidateCount')::int, 0)), 0)::bigint
                                                             AS icon_auto_candidate_total,
           COUNT(*) FILTER (
             WHERE COALESCE((meta->>'visualDefaultsApplied')::int, 0) > 0
           )::int                                          AS visual_default_generations,
           COALESCE(SUM(COALESCE((meta->>'visualDefaultsApplied')::int, 0)), 0)::bigint
                                                             AS visual_defaults_total,
           COALESCE(SUM(COALESCE((meta#>>'{visualSummary,vertexCount}')::int, 0)), 0)::bigint
                                                             AS visual_vertices_total,
           COALESCE(SUM(COALESCE((meta#>>'{visualSummary,iconVertexCount}')::int, 0)), 0)::bigint
                                                             AS visual_icon_vertices_total,
           COALESCE(SUM(COALESCE((meta#>>'{visualSummary,styledVertexCount}')::int, 0)), 0)::bigint
                                                             AS visual_styled_vertices_total,
           ROUND(
             AVG((meta#>>'{visualSummary,fillColorCount}')::numeric)
             FILTER (WHERE meta#>'{visualSummary}' IS NOT NULL),
             1
           )
                                                             AS avg_visual_fill_colors,
           ROUND(
             AVG((meta#>>'{visualSummary,shapeTypeCount}')::numeric)
             FILTER (WHERE meta#>'{visualSummary}' IS NOT NULL),
             1
           )
                                                             AS avg_visual_shape_types
         FROM diagram_generations`,
      ),
      query(
        `SELECT COALESCE(meta->>'provider', '—') AS provider,
                COALESCE(model, '—') AS model,
                COUNT(*)::int                          AS count,
                COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
                ROUND(AVG(generation_ms))::int         AS avg_generation_ms
           FROM diagram_generations
          GROUP BY COALESCE(meta->>'provider', '—'), model
          ORDER BY count DESC`,
      ),
      query(
        `SELECT COALESCE(preset, '—') AS preset,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (
                  WHERE jsonb_array_length(COALESCE(meta->'iconCandidates', '[]'::jsonb)) > 0
                )::int AS with_candidates,
                COUNT(*) FILTER (
                  WHERE jsonb_array_length(COALESCE(meta->'iconsApplied', '[]'::jsonb)) > 0
                )::int AS with_icons,
                COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconsApplied', '[]'::jsonb))), 0)::bigint
                  AS icons_applied,
                COALESCE(SUM(jsonb_array_length(COALESCE(meta->'iconsAutoApplied', '[]'::jsonb))), 0)::bigint
                  AS icons_auto_applied,
                COALESCE(SUM(COALESCE((meta->>'iconAutoEligible')::int, 0)), 0)::bigint
                  AS icon_auto_eligible,
                COALESCE(SUM(COALESCE((meta->>'iconAutoTarget')::int, 0)), 0)::bigint
                  AS icon_auto_target,
                COALESCE(SUM(COALESCE((meta->>'iconAutoCandidateCount')::int, 0)), 0)::bigint
                  AS icon_auto_candidate_count,
                COALESCE(SUM(COALESCE((meta->>'visualDefaultsApplied')::int, 0)), 0)::bigint
                  AS visual_defaults_applied,
                COALESCE(SUM(COALESCE((meta#>>'{visualSummary,vertexCount}')::int, 0)), 0)::bigint
                  AS visual_vertices,
                COALESCE(SUM(COALESCE((meta#>>'{visualSummary,iconVertexCount}')::int, 0)), 0)::bigint
                  AS visual_icon_vertices,
                COALESCE(SUM(COALESCE((meta#>>'{visualSummary,styledVertexCount}')::int, 0)), 0)::bigint
                  AS visual_styled_vertices,
                ROUND(
                  AVG((meta#>>'{visualSummary,fillColorCount}')::numeric)
                  FILTER (WHERE meta#>'{visualSummary}' IS NOT NULL),
                  1
                )
                  AS avg_visual_fill_colors,
                ROUND(
                  AVG((meta#>>'{visualSummary,shapeTypeCount}')::numeric)
                  FILTER (WHERE meta#>'{visualSummary}' IS NOT NULL),
                  1
                )
                  AS avg_visual_shape_types
           FROM diagram_generations
          WHERE status = 'completed'
          GROUP BY preset
          ORDER BY with_icons DESC, icons_applied DESC, count DESC`,
      ),
      query(
        `SELECT g.id, g.preset, g.model, g.status,
                COALESCE(g.meta->>'provider', '—') AS provider,
                g.generation_ms, g.first_token_ms, g.diagram_bytes,
                g.prompt_tokens, g.completion_tokens, g.total_tokens,
                g.finish_reason, g.error, g.created_at,
                jsonb_array_length(COALESCE(g.meta->'iconCandidates', '[]'::jsonb))::int
                  AS icon_candidate_count,
                jsonb_array_length(COALESCE(g.meta->'iconsApplied', '[]'::jsonb))::int
                  AS icon_applied_count,
                jsonb_array_length(COALESCE(g.meta->'iconsAutoApplied', '[]'::jsonb))::int
                  AS icon_auto_applied_count,
                jsonb_array_length(COALESCE(g.meta->'iconsMissing', '[]'::jsonb))::int
                  AS icon_missing_count,
                COALESCE((g.meta->>'iconAutoEligible')::int, 0)::int
                  AS icon_auto_eligible,
                COALESCE((g.meta->>'iconAutoTarget')::int, 0)::int
                  AS icon_auto_target,
                COALESCE((g.meta->>'iconAutoCandidateCount')::int, 0)::int
                  AS icon_auto_candidate_count,
                COALESCE((g.meta->>'visualDefaultsApplied')::int, 0)::int
                  AS visual_defaults_applied,
                COALESCE((g.meta#>>'{visualSummary,vertexCount}')::int, 0)::int
                  AS visual_vertex_count,
                COALESCE((g.meta#>>'{visualSummary,iconVertexCount}')::int, 0)::int
                  AS visual_icon_vertex_count,
                COALESCE((g.meta#>>'{visualSummary,styledVertexCount}')::int, 0)::int
                  AS visual_styled_vertex_count,
                COALESCE((g.meta#>>'{visualSummary,fillColorCount}')::int, 0)::int
                  AS visual_fill_color_count,
                COALESCE((g.meta#>>'{visualSummary,shapeTypeCount}')::int, 0)::int
                  AS visual_shape_type_count,
                COALESCE(g.meta->'iconCandidates', '[]'::jsonb) AS icon_candidates,
                COALESCE(g.meta->'iconsApplied', '[]'::jsonb) AS icons_applied,
                COALESCE(g.meta->'iconsAutoApplied', '[]'::jsonb) AS icons_auto_applied,
                COALESCE(g.meta->'iconsMissing', '[]'::jsonb) AS icons_missing,
                COALESCE(g.meta->'iconAutoSkipped', '{}'::jsonb) AS icon_auto_skipped,
                v.title AS viz_title,
                u.email AS user_email, u.name AS user_name
           FROM diagram_generations g
           LEFT JOIN visualizations v ON v.id = g.visualization_id
           LEFT JOIN users u ON u.id = g.user_id
          ORDER BY g.created_at DESC
          LIMIT 100`,
      ),
    ]);

    res.json({
      totals: totals.rows[0],
      byModel: byModel.rows,
      byPresetIcons: byPresetIcons.rows,
      recent: recent.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── Draw.io icon library catalog ──────────────────────────────
router.get("/icon-libraries", async (req, res, next) => {
  try {
    res.json({ libraries: await listIconLibraries() });
  } catch (err) {
    next(err);
  }
});

router.get("/icon-libraries/search", async (req, res, next) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ objects: [] });

  try {
    const objects = await searchIconObjects(q, { limit: 50 });
    res.json({ objects });
  } catch (err) {
    next(err);
  }
});

router.post("/icon-libraries", async (req, res, next) => {
  const {
    id,
    name,
    provider,
    styleFamily,
    sourceUrl,
    sourceType,
    version,
    content,
  } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Library name is required" });
  }
  if (!content || typeof content !== "string" || !content.includes("<mxlibrary")) {
    return res.status(400).json({ error: "A draw.io <mxlibrary> XML file is required" });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_ICON_LIBRARY_BYTES) {
    return res.status(413).json({ error: "Library file is too large (max 10 MiB)" });
  }

  try {
    const result = await ingestDrawioLibrary({
      id,
      name: name.trim(),
      provider: provider ? String(provider).trim() : null,
      styleFamily: styleFamily ? String(styleFamily).trim() : null,
      sourceUrl: sourceUrl ? String(sourceUrl).trim() : null,
      sourceType: sourceType || "admin-upload",
      version: version ? String(version).trim() : null,
      content,
      metadata: { uploadedBy: req.user.email },
    });
    res.status(201).json({ library: result });
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not ingest library" });
  }
});

router.get("/icon-libraries/:id/objects", async (req, res, next) => {
  try {
    res.json({ objects: await listIconObjects(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/icon-libraries/:id/objects/:objectId/preview",
  async (req, res, next) => {
    try {
      const preview = await getIconObjectPreview(req.params.id, req.params.objectId);
      if (!preview) return res.status(404).json({ error: "Object not found" });
      res.json(preview);
    } catch (err) {
      next(err);
    }
  },
);

router.delete("/icon-libraries/:id", async (req, res, next) => {
  try {
    const deleted = await deleteIconLibrary(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── LLM providers and models ──────────────────────────────────
router.get("/llm-catalog", async (req, res, next) => {
  try {
    res.json({
      providers: await listAdminCatalog(),
      levels: LEVELS.map(({ level, name }) => ({ level, name })),
    });
  } catch (err) {
    next(err);
  }
});

function catalogError(res, err) {
  return res.status(err.status || 400).json({ error: err.message });
}

router.post("/llm-providers", async (req, res, next) => {
  try {
    const provider = await createProvider(req.body || {});
    res.status(201).json({ provider });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

router.patch("/llm-providers/:id", async (req, res, next) => {
  try {
    const provider = await updateProvider(req.params.id, req.body || {});
    res.json({ provider });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

router.delete("/llm-providers/:id", async (req, res, next) => {
  try {
    await deleteProvider(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

router.post("/llm-models", async (req, res, next) => {
  try {
    const model = await createModel(req.body || {});
    res.status(201).json({ model });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

router.patch("/llm-models/:id", async (req, res, next) => {
  try {
    const model = await updateModel(req.params.id, req.body || {});
    res.json({ model });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

router.delete("/llm-models/:id", async (req, res, next) => {
  try {
    await deleteModel(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return catalogError(res, err);
    next(err);
  }
});

// ── User management ───────────────────────────────────────────
router.get("/users", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.is_admin, u.level, u.created_at,
              COUNT(v.id)::int AS viz_count
         FROM users u
         LEFT JOIN visualizations v ON v.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC`,
    );
    // Ship the level catalogue (name + current limit) alongside so the UI can
    // render the tier selector without duplicating the names client-side.
    const levels = LEVELS.map((l) => resolveLevel(l.level));
    res.json({ users: rows, levels });
  } catch (err) {
    next(err);
  }
});

// Update a user's role and/or membership level. Either field is optional, so
// the admin panel can change one without touching the other.
router.patch("/users/:id", async (req, res, next) => {
  const { isAdmin, level } = req.body || {};

  if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
    return res.status(400).json({ error: "isAdmin must be a boolean" });
  }
  if (level !== undefined && !isValidLevel(level)) {
    return res
      .status(400)
      .json({ error: `level must be an integer between 1 and ${LEVELS.length}` });
  }
  if (isAdmin === undefined && level === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const targetId = String(req.params.id);
  try {
    // Don't allow removing the last remaining admin.
    if (isAdmin === false) {
      const { rows } = await query(
        "SELECT COUNT(*)::int AS count FROM users WHERE is_admin",
      );
      const target = await query(
        "SELECT is_admin FROM users WHERE id = $1",
        [targetId],
      );
      if (target.rows[0]?.is_admin && rows[0].count <= 1) {
        return res
          .status(400)
          .json({ error: "Cannot remove the last administrator" });
      }
    }

    // Build a COALESCE-based update so omitted fields keep their current value.
    const { rows } = await query(
      `UPDATE users
          SET is_admin = COALESCE($1, is_admin),
              level    = COALESCE($2, level)
        WHERE id = $3
       RETURNING id, email, name, is_admin, level`,
      [isAdmin ?? null, level ?? null, targetId],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete a user (and, via cascade, all their visualizations).
router.delete("/users/:id", async (req, res, next) => {
  const targetId = String(req.params.id);
  if (targetId === String(req.user.id)) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    const { rowCount } = await query("DELETE FROM users WHERE id = $1", [
      targetId,
    ]);
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Application settings ──────────────────────────────────────
router.get("/settings", (req, res) => {
  // Return current values alongside the schema so the UI can render typed
  // inputs with labels/help/ranges.
  res.json({ settings: getAllSettings(), schema: SETTINGS_SCHEMA });
});

router.put("/settings", async (req, res, next) => {
  try {
    const settings = await updateSettings(req.body || {});
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
