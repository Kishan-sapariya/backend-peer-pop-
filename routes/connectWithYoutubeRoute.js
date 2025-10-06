import express from "express";
import { google } from "googleapis";
import prisma from "../util/prisma.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get("/auth", (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.YOUTUBE_CALLBACK_URL 
  );

  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    process.env.YOUTUBE_CALLBACK_URL 
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res
        .status(401)
        .json({ message: "Authentication failed: access token missing." });
    }

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      return res.status(404).json({ message: "No channel found" });
    }

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const userInfo = await oauth2.userinfo.get();

    const connectedGoogleId = userInfo.data.id;
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { statistics, snippet } = channel;
    const createdAt = new Date(snippet.publishedAt);
    const now = new Date();
    const monthsOld =
      (now.getFullYear() - createdAt.getFullYear()) * 12 +
      now.getMonth() - createdAt.getMonth();

    const youtubeData = {
      source: "youtube",
      title: snippet.title,
      thumbnail: snippet.thumbnails?.high?.url,
      subscriberCount: statistics.subscriberCount,
      totalViews: statistics.viewCount,
      videoCount: statistics.videoCount,
      channelAge: monthsOld,
    };

    await prisma.youTubeAuth.upsert({
      where: { userProfileId: userId },
      update: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        googleId: connectedGoogleId,
      },
      create: {
        userProfileId: userId,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        googleId: connectedGoogleId,
      },
    });

    await prisma.youTubeStats.upsert({
      where: { userProfileId: userId },
      update: { stats: youtubeData },
      create: {
        userProfileId: userId,
        stats: youtubeData,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/onboarding/youtuber`);
  } catch (error) {
    console.error("YouTube OAuth failed:", error);
    res.status(500).json({ message: "YouTube connection failed" });
  }
});

export default router;
