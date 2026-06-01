// Gate routes behind an authenticated session.
export function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}
