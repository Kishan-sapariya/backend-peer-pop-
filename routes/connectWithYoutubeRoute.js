import express from "express";
import { google } from "googleapis";
import prisma from "../util/prisma.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = express.Router();

// Simple in-memory state store (good enough for your case)
const stateStore = new Map();

router.get("/auth", (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.YOUTUBE_CALLBACK_URL
  );

  const state = crypto.randomUUID();
  stateStore.set(state, true);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures refresh_token on first connect
    scope: ["https://www.googleapis.com/auth/youtube.readonly"],
    state,
  });

  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!stateStore.has(state)) {
    return res.status(401).json({ message: "Invalid OAuth state" });
  }
  stateStore.delete(state);

  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "User not logged in" });

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
    if (!channel) return res.status(404).json({ message: "No channel found" });

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

    // Store tokens (refresh token only matters for cron updates)
    await prisma.youTubeAuth.upsert({
      where: { userProfileId: userId },
      update: {
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        tokenType: tokens.token_type,
        googleId: channelId, // <-- correct unique id
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

    // Store Stats
    await prisma.youTubeStats.upsert({
      where: { userProfileId: userId },
      update: { stats: youtubeData },
      create: {
        userProfileId: userId,
        stats: youtubeData,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/onboarding/youtuber`);
  } catch (err) {
    console.error("YouTube OAuth failed:", err);
    res.status(500).json({ message: "YouTube connection failed" });
  }
});

export default router;
