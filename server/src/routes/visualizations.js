import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query, pool } from "../db.js";
import { resolveLevel } from "../services/settings.js";
import { generateDrawio } from "../services/llm.js";
import { isValidPreset, listPresets } from "../services/presets.js";

const router = Router();

// Public: available presets and the source-text limit (used to render the
// create form, including its live character counter).
router.get("/presets", (req, res) => {
  // Public route (no session): advertise the entry-tier input cap as a fallback.
  // The create form refines this to the signed-in user's level cap (from /me).
  res.json({ presets: listPresets(), maxSourceChars: resolveLevel(1).maxChars });
});

router.use(requireAuth);

// List the current user's visualizations (newest first, no XML payload).
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, preset, status, created_at
         FROM visualizations
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.json({ visualizations: rows });
  } catch (err) {
    next(err);
  }
});

// Fetch a single visualization including its draw.io XML. The client polls this
// endpoint after creating a visualization to watch `status` transition from
// 'pending'/'processing' to 'completed' or 'failed'.
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, preset, source_text, drawio_xml, status, error, created_at
         FROM visualizations
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ visualization: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Save edits to a diagram's draw.io XML (from the embedded editor).
router.put("/:id", async (req, res, next) => {
  const { drawioXml } = req.body || {};
  if (!drawioXml || typeof drawioXml !== "string" || !drawioXml.trim()) {
    return res.status(400).json({ error: "drawioXml is required" });
  }
  if (drawioXml.length > 5_000_000) {
    return res.status(413).json({ error: "Diagram is too large" });
  }
  try {
    const { rowCount } = await query(
      `UPDATE visualizations
          SET drawio_xml = $1
        WHERE id = $2 AND user_id = $3`,
      [drawioXml, req.params.id, req.user.id],
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Generate the diagram in the background and update the row in place. Runs
// detached from the HTTP request that created the row, so a slow model can't
// hold a connection open long enough to trip the proxy/Cloudflare 524 timeout.
async function runGeneration(vizId, userId, { preset, sourceText, title, maxSourceChars }) {
  const startedAt = Date.now();
  try {
    await query("UPDATE visualizations SET status = 'processing' WHERE id = $1", [
      vizId,
    ]);

    const { xml, usage, meta } = await generateDrawio({
      preset,
      sourceText,
      title,
      maxSourceChars,
    });

    await query(
      `UPDATE visualizations
          SET drawio_xml = $1, status = 'completed', error = NULL
        WHERE id = $2`,
      [xml, vizId],
    );

    await recordGeneration({
      vizId,
      userId,
      preset,
      status: "completed",
      usage,
      meta,
    });

    console.log("[viz] generate done", {
      userId,
      vizId,
      totalMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[viz] generate failed", {
      userId,
      vizId,
      preset,
      totalMs: Date.now() - startedAt,
      message: err?.message,
    });
    await query(
      "UPDATE visualizations SET status = 'failed', error = $1 WHERE id = $2",
      [err?.message || "Generation failed", vizId],
    ).catch((e) =>
      console.error("[viz] could not record failure", { vizId, message: e?.message }),
    );
    await recordGeneration({
      vizId,
      userId,
      preset,
      status: "failed",
      error: err?.message || "Generation failed",
    });
  }
}

// Persist one row of generation telemetry. Best-effort: a logging failure must
// never mask the underlying generation result, so errors here are swallowed.
async function recordGeneration({ vizId, userId, preset, status, usage, meta, error }) {
  const m = meta || {};
  try {
    await query(
      `INSERT INTO diagram_generations
         (visualization_id, user_id, preset, model, status,
          generation_ms, first_token_ms, diagram_bytes,
          prompt_tokens, completion_tokens, total_tokens,
          temperature, top_p, finish_reason, meta, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        vizId,
        userId,
        preset,
        m.model ?? null,
        status,
        m.elapsedMs ?? null,
        m.firstTokenMs ?? null,
        m.diagramBytes ?? null,
        usage?.prompt_tokens ?? null,
        usage?.completion_tokens ?? null,
        usage?.total_tokens ?? null,
        m.temperature ?? null,
        m.topP ?? null,
        m.finishReason ?? null,
        usage ? JSON.stringify(usage) : null,
        error ?? null,
      ],
    );
  } catch (e) {
    console.error("[viz] could not record generation telemetry", {
      vizId,
      message: e?.message,
    });
  }
}

// Start a new visualization, enforcing the per-account quota atomically. The
// row is created in 'pending' state and returned right away (202); generation
// proceeds in the background and the client polls GET /:id for the result.
router.post("/", async (req, res, next) => {
  const { sourceText, preset, title } = req.body || {};

  if (!sourceText || typeof sourceText !== "string" || !sourceText.trim()) {
    return res.status(400).json({ error: "sourceText is required" });
  }
  if (!isValidPreset(preset)) {
    return res.status(400).json({ error: "Unknown preset" });
  }
  // Hard ceiling on the stored payload, matching the max allowed per-level char
  // setting (admin char limits are capped at 100k). Input within this ceiling
  // but over the user's own level cap is truncated at generation time.
  if (sourceText.length > 100_000) {
    return res.status(413).json({ error: "Source text is too large (max 100k chars)" });
  }

  const { limit, maxChars } = resolveLevel(req.user.level);
  console.log("[viz] generate request", {
    userId: req.user.id,
    preset,
    sourceChars: sourceText.length,
  });

  const finalTitle =
    (title && String(title).trim()) ||
    sourceText.trim().split(/\s+/).slice(0, 6).join(" ") ||
    "Untitled";

  // Quota check inside a transaction with a row lock on the user, so two
  // concurrent requests can't both slip past the limit. Failed attempts don't
  // count against the quota, so a transient error doesn't burn a slot.
  const dbClient = await pool.connect();
  let viz;
  let used;
  try {
    await dbClient.query("BEGIN");
    await dbClient.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
      req.user.id,
    ]);

    const { rows: countRows } = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM visualizations WHERE user_id = $1 AND status <> 'failed'",
      [req.user.id],
    );
    if (countRows[0].count >= limit) {
      await dbClient.query("ROLLBACK");
      return res.status(403).json({
        error: `Account limit reached (${limit} visualizations).`,
        quota: { used: countRows[0].count, limit, remaining: 0 },
      });
    }

    const { rows } = await dbClient.query(
      `INSERT INTO visualizations (user_id, title, preset, source_text, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, title, preset, status, created_at`,
      [req.user.id, finalTitle, preset, sourceText],
    );

    await dbClient.query("COMMIT");
    viz = rows[0];
    used = countRows[0].count + 1;
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    console.error("[viz] create failed", {
      userId: req.user?.id,
      preset,
      message: err?.message,
    });
    return next(err);
  } finally {
    dbClient.release();
  }

  // Kick off generation without awaiting it, then respond immediately.
  runGeneration(viz.id, req.user.id, {
    preset,
    sourceText,
    title: finalTitle,
    maxSourceChars: maxChars,
  });

  res.status(202).json({
    visualization: viz,
    quota: { used, limit, remaining: Math.max(0, limit - used) },
  });
});

export default router;
