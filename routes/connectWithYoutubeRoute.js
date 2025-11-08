import express from "express";
import { google } from "googleapis";
import prisma from "../util/prisma.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = express.Router();
const stateStore = new Map();

router.get("/auth", (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.YOUTUBE_CALLBACK_URL
  );

  const state = crypto.randomUUID();
  stateStore.set(state, true);

  // If user clicks "Try another account", we attach ?select=1
  const forceSelect = req.query.select === "1";
  const prompt = forceSelect ? "consent select_account" : "consent";

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt,
    scope: ["https://www.googleapis.com/auth/youtube.readonly"],
    state,
  });

  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  // State verification
  if (!stateStore.has(state)) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/onboarding/youtuber/error?reason=invalid_state`
    );
  }
  stateStore.delete(state);

  // Verify logged in user
  const token = req.cookies.token;
  if (!token) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?reason=not_logged_in`
    );
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.YOUTUBE_CALLBACK_URL
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    });

    const channel = response.data.items?.[0];

    // ⛔ No YouTube channel → redirect to UI page
    if (!channel) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/onboarding/youtuber/no-channel`
      );
    }

    const { id: channelId, statistics, snippet } = channel;

    const createdAt = new Date(snippet.publishedAt);
    const now = new Date();
    const monthsOld =
      (now.getFullYear() - createdAt.getFullYear()) * 12 +
      now.getMonth() -
      createdAt.getMonth();

    const youtubeData = {
      source: "youtube",
      title: snippet.title,
      thumbnail: snippet.thumbnails?.high?.url,
      subscriberCount: statistics.subscriberCount,
      totalViews: statistics.viewCount,
      videoCount: statistics.videoCount,
      channelAge: monthsOld,
    };

    // Store OAuth tokens
    await prisma.youTubeAuth.upsert({
      where: { userProfileId: userId },
      update: {
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        tokenType: tokens.token_type,
        googleId: channelId,
      },
      create: {
        userProfileId: userId,
        refreshToken: tokens.refresh_token ?? null,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        tokenType: tokens.token_type,
        googleId: channelId,
      },
    });

    // Store stats
    await prisma.youTubeStats.upsert({
      where: { userProfileId: userId },
      update: { stats: youtubeData },
      create: { userProfileId: userId, stats: youtubeData },
    });

    return res.redirect(`${process.env.FRONTEND_URL}/onboarding/youtuber`);
  } catch (err) {
    console.error("YouTube OAuth failed:", err);
    return res.redirect(
      `${process.env.FRONTEND_URL}/onboarding/youtuber/error?reason=oauth_failed`
    );
  }
});

export default router;
