import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "../util/prisma.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/api/auth/google/callback",
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const emailEntry = profile.emails?.[0];
        const email = emailEntry?.value;

        // Require a Google-verified email.
        if (!email || emailEntry.verified === false) {
          return done(null, false, { message: "Google email not verified" });
        }

        let user = await prisma.userProfile.findUnique({ where: { email } });
        let isNewUser = false;

        if (!user) {
          user = await prisma.userProfile.create({
            data: {
              email,
              username: profile.displayName,
              image: profile.photos[0]?.value,
              googleId: profile.id,
              provider: "google",
              emailVerified: true,
            },
          });
          isNewUser = true;
        } else {
          // An account with this email already exists. Only allow Google sign-in
          // if it's the SAME Google account already linked — never auto-merge a
          // local/password account by email alone (account-takeover vector).
          if (user.googleId && user.googleId !== profile.id) {
            return done(null, false, {
              message: "This email is linked to a different Google account",
            });
          }
          if (!user.googleId) {
            return done(null, false, {
              message:
                "An account with this email already exists. Please log in with your password.",
            });
          }
        }

        done(null, { ...user, isNewUser });
      } catch (error) {
        done(error, null);
      }
    }
  )
);

export default passport;
