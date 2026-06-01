import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config.js";
import { query } from "../db.js";

// Persist the user row id in the session; rehydrate the full user per request.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";
        const avatarUrl = profile.photos?.[0]?.value || "";

        // Upsert on google_id, keeping profile fields fresh.
        const { rows } = await query(
          `INSERT INTO users (google_id, email, name, avatar_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (google_id) DO UPDATE
             SET email = EXCLUDED.email,
                 name = EXCLUDED.name,
                 avatar_url = EXCLUDED.avatar_url
           RETURNING *`,
          [googleId, email, name, avatarUrl],
        );
        done(null, rows[0]);
      } catch (err) {
        done(err);
      }
    },
  ),
);

export default passport;
