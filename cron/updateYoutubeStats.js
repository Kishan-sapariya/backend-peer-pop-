import cron from "node-cron";
import { google } from "googleapis";
import prisma from "../util/prisma.js";

cron.schedule("0 */6 * * *", async () => {
  console.log("[CRON] Starting YouTube stats update...");

  const allAuths = await prisma.youTubeAuth.findMany({
    include: { userProfile: true },
  });

  for (const auth of allAuths) {
    if (!auth.refreshToken) {
      console.warn(`No refresh token found for user ${auth.userProfileId}`);
      continue;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: auth.refreshToken });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    try {
      const response = await youtube.channels.list({
        part: ["snippet", "statistics"],
        mine: true,
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        console.warn(`No channel found for user ${auth.userProfileId}`);
        continue;
      }

      const { statistics, snippet } = channel;
      const createdAt = new Date(snippet.publishedAt);
      const now = new Date();
      const monthsOld =
        (now.getFullYear() - createdAt.getFullYear()) * 12 +
        now.getMonth() -
        createdAt.getMonth();

      const updatedStats = {
        source: "youtube",
        title: snippet.title,
        thumbnail: snippet.thumbnails?.high?.url,
        subscriberCount: statistics.subscriberCount,
        totalViews: statistics.viewCount,
        videoCount: statistics.videoCount,
        avgViews:
          statistics.videoCount > 0
            ? Math.floor(statistics.viewCount / statistics.videoCount)
            : 0,
        channelAge: monthsOld,
        monthlyViews: null,
        watchTimeHours: null,
      };

      await prisma.youTubeStats.upsert({
        where: { userProfileId: auth.userProfileId },
        update: { stats: updatedStats },
        create: {
          userProfileId: auth.userProfileId,
          stats: updatedStats,
        },
      });

      console.log(`[CRON] Updated stats for user ${auth.userProfileId}`);
    } catch (err) {
      console.error(
        `Error updating YouTube stats for user ${auth.userProfileId}:`,
        err.message
      );
    }
  }

  console.log("[CRON] YouTube stats refresh complete.");
});
