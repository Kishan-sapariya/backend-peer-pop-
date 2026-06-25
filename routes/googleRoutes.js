import express from "express";
import passport from "../config/passport.js";
import { generateToken, setCookieToken } from "../util/generateToken.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
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
    // Sign only minimal claims — never the whole user row (the JWT payload is
    // base64, not encrypted, so a full row would expose the password hash).
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    setCookieToken(res, token);

    const redirectUrl = user.isNewUser
      ? `${process.env.FRONTEND_URL}/onboarding`
      : `${process.env.FRONTEND_URL}/feed`;

    res.redirect(redirectUrl);
  }
);

export default router;
