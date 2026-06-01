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
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${config.appUrl}/login?error=auth`,
  }),
  (req, res) => {
    res.redirect(`${config.appUrl}/`);
  },
);

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
