import express from "express";
import passport from "../config/passport.js";
import { generateToken, setCookieToken } from "../util/generateToken.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    accessType: "offline",
    prompt: "consent",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const user = req.user;
    const token = generateToken(user);

    setCookieToken(res, token);

    const redirectUrl = user.isNewUser
      ? `${process.env.FRONTEND_URL}/onboarding`
      : `${process.env.FRONTEND_URL}/feed`;

    res.redirect(redirectUrl);
  }
);

export default router;
