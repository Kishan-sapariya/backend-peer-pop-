import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js";
import googleRoutes from "./routes/googleRoutes.js";
import youtubeRoutes from "./routes/youtubeRoute.js";
import comedainRoutes from "./routes/comedianRoute.js";
import influencerRoutes from "./routes/influencerRoute.js";
import filmMakerRoutes from "./routes/filmMakerRoute.js";
import musicianRoutes from "./routes/musicianRoute.js";
import dancerRoutes from "./routes/dancerRoute.js";
import connectWithYoutubeRoutes from "./routes/connectWithYoutubeRoute.js";
import passport from "./config/passport.js";
dotenv.config();

import "./cron/updateYoutubeStats.js"

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth/", authRoutes);
app.use("/api/auth/", googleRoutes);
app.use("/api/youtube/", youtubeRoutes);
app.use("/api/youtube/", connectWithYoutubeRoutes);
app.use("/api/comedian/", comedainRoutes);
app.use("/api/influencer/", influencerRoutes);
app.use("/api/filmmaker/", filmMakerRoutes);
app.use("/api/musician/", musicianRoutes);
app.use("/api/dancer/", dancerRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
