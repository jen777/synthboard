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

const router = Router();

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
