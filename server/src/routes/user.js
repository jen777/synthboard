import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../db.js";
import { config } from "../config.js";

const router = Router();

// Current user + remaining quota. Returns null user when unauthenticated
// so the SPA can render the login screen without treating it as an error.
router.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });

  const { rows } = await query(
    "SELECT COUNT(*)::int AS count FROM visualizations WHERE user_id = $1",
    [req.user.id],
  );
  const used = rows[0].count;
  const limit = config.maxVisualizationsPerAccount;

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatarUrl: req.user.avatar_url,
    },
    quota: { used, limit, remaining: Math.max(0, limit - used) },
  });
});

router.use(requireAuth);

export default router;
