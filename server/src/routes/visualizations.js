import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query, pool } from "../db.js";
import { getSetting } from "../services/settings.js";
import { generateDrawio } from "../services/llm.js";
import { isValidPreset, listPresets } from "../services/presets.js";

const router = Router();

// Public: available presets (used to render the create form).
router.get("/presets", (req, res) => {
  res.json({ presets: listPresets() });
});

router.use(requireAuth);

// List the current user's visualizations (newest first, no XML payload).
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, preset, created_at
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

// Fetch a single visualization including its draw.io XML.
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, preset, source_text, drawio_xml, created_at
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

// Generate a new visualization, enforcing the per-account quota atomically.
router.post("/", async (req, res, next) => {
  const { sourceText, preset, title } = req.body || {};

  if (!sourceText || typeof sourceText !== "string" || !sourceText.trim()) {
    return res.status(400).json({ error: "sourceText is required" });
  }
  if (!isValidPreset(preset)) {
    return res.status(400).json({ error: "Unknown preset" });
  }
  if (sourceText.length > 100_000) {
    return res.status(413).json({ error: "Source text is too large (max 100k chars)" });
  }

  const limit = getSetting("max_visualizations_per_account");

  // Quota check inside a transaction with a row lock on the user, so two
  // concurrent requests can't both slip past the limit.
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    await dbClient.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
      req.user.id,
    ]);

    const { rows: countRows } = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM visualizations WHERE user_id = $1",
      [req.user.id],
    );
    if (countRows[0].count >= limit) {
      await dbClient.query("ROLLBACK");
      return res.status(403).json({
        error: `Account limit reached (${limit} visualizations).`,
        quota: { used: countRows[0].count, limit, remaining: 0 },
      });
    }

    // Generate the diagram. This can take a while; the row lock is held only
    // for this request's user row, which is acceptable for a per-user quota.
    const finalTitle =
      (title && String(title).trim()) ||
      sourceText.trim().split(/\s+/).slice(0, 6).join(" ") ||
      "Untitled";

    const { xml } = await generateDrawio({
      preset,
      sourceText,
      title: finalTitle,
    });

    const { rows } = await dbClient.query(
      `INSERT INTO visualizations (user_id, title, preset, source_text, drawio_xml)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, preset, created_at`,
      [req.user.id, finalTitle, preset, sourceText, xml],
    );

    await dbClient.query("COMMIT");

    const used = countRows[0].count + 1;
    res.status(201).json({
      visualization: { ...rows[0], drawio_xml: xml },
      quota: { used, limit, remaining: Math.max(0, limit - used) },
    });
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    dbClient.release();
  }
});

export default router;
