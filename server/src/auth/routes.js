import { Router } from "express";
import passport from "./passport.js";
import { config } from "../config.js";

const router = Router();

// Kick off Google OAuth.
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// OAuth callback → set session, bounce back to the SPA.
// Custom callback so any OAuth error (e.g. a replayed/expired single-use code
// on page refresh → invalid_grant) redirects to login instead of throwing a 500.
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", (err, user) => {
    if (err || !user) {
      return res.redirect(`${config.appUrl}/login?error=auth`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.redirect(`${config.appUrl}/login?error=auth`);
      }
      return res.redirect(`${config.appUrl}/`);
    });
  })(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

export default router;
