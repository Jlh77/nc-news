const passport = require("passport");
const db = require("../../db/connection");

/**
 * GOOGLE STRATEGY
 *
 * Used for both authenticating and linking of accounts
 */

const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy( // Default name google
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      // If user is logged in, proceed to simply link account
      if (req.user) {
        req.user.google_id = profile.id;
        req.user.google_email = profile.emails[0].value;
        req.user.google_display_name = profile.displayName;

        db.query(
          "UPDATE users SET google_id = $1, google_email = $2 WHERE user_id = $3;",
          [req.user.google_id, req.user.google_email, req.user.id]
        )
          .then((rows) => {
            // No error (google account not already in use) link and return updated user
            return done(null, req.user);
          })
          .catch((err) => {
            // If google account is duplicate (linked to different account) will return error
            return done(null, false, {
              success: false,
              message:
                "The Google account you tried to link is already associated with another account.",
            }); //IMPORTANT Error flash not working, fix
          });
      }

      // If not logged in
      else {
        try {
          // Check if google account is registered
          let rows = await db.query(
            "SELECT * FROM users WHERE google_id = $1;",
            [profile.id]
          );

          // If user already registered, log in
          if (rows.length) {
            return done(null, rows[0]);
          }

          // Check if email in use before inserting, if so link and login
          rows = await db.query("SELECT * FROM users WHERE email = $1;", [
            profile.emails[0].value,
          ]);

          if (rows.length) {
            const existingUser = rows[0];
            existingUser.google_email = profile.emails[0].value;
            existingUser.google_display_name = profile.displayName;

            const rows = await db.query(
              "UPDATE users SET google_id = $1, google_email = $2 WHERE user_id = $3;",
              [
                existingUser.google_id,
                existingUser.google_email,
                existingUser.user_id,
              ]
            );
            return done(null, existingUser);
          }
          // If no existing record, register the user.
          else {
            const newUser = {
              email: profile.emails[0].value,
              // Google account specific fields
              google_id: profile.id,
              method: "gl", // This field ties this new user to the google account
              // General fields (taken from the stuff google gives us)
              name:
                profile.name.givenName && profile.name.familyName
                  ? `${profile.name.givenName} ${profile.name.familyName}`
                  : "",
              google_email: profile.emails[0].value,
              avatar_url: profile.coverPhoto || null,
            };

            db.query(
              "INSERT INTO users (email, google_id, original_method, name, google_email, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;",
              [
                newUser.email,
                newUser.google_id,
                newUser.method,
                newUser.name,
                newUser.google_email,
                newUser.avatar_url,
              ]
            ).then((rows) => {
              return done(null, rows[0]);
            });
          }
        } catch (err) {
          return done(err);
        }
      }
    }
  )
);