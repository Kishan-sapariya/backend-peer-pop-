import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "../util/prisma.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/api/auth/google/callback",
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
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
        }

        done(null, { ...user, isNewUser });
      } catch (error) {
        done(error, null);
      }
    }
  )
);

export default passport;
