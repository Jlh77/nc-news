const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const db = require("../../db/connection");
const genHash = require("../lib/passwordConfig").genHash;
const validate = require("../lib/passwordConfig").validate;

// Local login strategy
passport.use(
  "local-login",
  new LocalStrategy(
    {
      // by default, local strategy uses username and password, we will override with email
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true, // allows us to pass back the entire request to the callback
    },
    function (req, email, password, done) {
      // callback with email and password from our form
      pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        function (err, rows) {
          if (err) {
            return done(err);
          }
          if (!rows.length) {
            return done(null, false, { message: "Wrong email or password." }); // req.flash is the way to set flashdata using connect-flash
          }
          if (rows[0].salt === null || rows[0].password === null) {
            // User hasn't created a password because they signed up with social
            return done(null, false, {
              message:
                "You signed up using an external account. Please either log in using your social media account, or you can create a password by clicking forgot password below.",
            });
          }
          const isValid = validate(password, rows[0].password, rows[0].salt);
          // if the user is found but the password is wrong
          if (!isValid)
            return done(null, false, { message: "Wrong email or password." }); // create the loginMessage and save it to session as flashdata

          // all is well, but first, check the remember parameter to decide cookie (defaults to 3 months)
          if (!req.body.remember) req.session.cookie.expires = false;
          // return successful user
          return done(null, rows[0]);
        }
      );
    }
  )
);

// Local register strategy
passport.use(
  "local-register",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true, // allows us to pass back the entire request to the callback
    },

    function (req, email, password, done) {
      // find a user whose email is the same as the forms email
      pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        function (err, rows) {
          if (err) {
            return done(err);
          }
          if (
            rows.length &&
            (rows[0].salt === null || rows[0].password === null)
          ) {
            return done(null, false, {
              message:
                "You signed up using an external account. Please either log in using your social media account, or you can create a password by clicking forgot password below.",
            });
          }
          if (rows.length) {
            return done(null, false, {
              message: "That email is already registered.",
            });
          } else {
            // if there is no user with that email
            // create the user
            const saltHash = genHash(password);
            password = ""; // Erase plain text password jic

            let newUser = {
              email: email.toLowerCase(),
              password: saltHash.hash,
              salt: saltHash.salt,
            };

            pool.query(
              "INSERT INTO users (email, password, salt, method) VALUES (?,?,?,?)",
              [newUser.email, newUser.password, newUser.salt, "lo"],
              function (err, rows) {
                if (err) {
                  return done(err);
                }
                newUser.id = rows.insertId;
                return done(null, newUser);
              }
            );
          }
        }
      );
    }
  )
);