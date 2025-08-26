import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoute.js";
import googleRoutes from "./routes/googleRoutes.js";
import youtubeRoutes from "./routes/youtubeRoute.js";
import comedainRoutes from "./routes/comedianRoute.js";
import influencerRoutes from "./routes/influencerRoute.js";
import filmMakerRoutes from "./routes/filmMakerRoute.js";
import musicianRoutes from "./routes/musicianRoute.js";
import dancerRoutes from "./routes/dancerRoute.js";
import connectionRoutes from "./routes/connectionRoute.js";
import connectWithYoutubeRoutes from "./routes/connectWithYoutubeRoute.js";
import conversationRoutes from "./routes/conversationRoute.js";
import notificationRoutes from "./routes/notificationRoute.js";
import feedsRoutes from "./routes/feedsRoute.js";
import passport from "./config/passport.js";
import "./cron/updateYoutubeStats.js";

dotenv.config();

const app = express();

// middlewares
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

// routes
app.use("/api/auth/", authRoutes);
app.use("/api/auth/", googleRoutes);
app.use("/api/youtube/", youtubeRoutes);
app.use("/api/youtube/", connectWithYoutubeRoutes);
app.use("/api/comedian/", comedainRoutes);
app.use("/api/influencer/", influencerRoutes);
app.use("/api/filmmaker/", filmMakerRoutes);
app.use("/api/musician/", musicianRoutes);
app.use("/api/dancer/", dancerRoutes);
app.use("/api/connection", connectionRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/feed", feedsRoutes);

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("sendMessage", ({ receiverId, message }) => {
    io.to(receiverId).emit("receiveMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
  io.on("connection", (socket) => {
    console.log(
      "🔌 New client connected:",
      socket.id,
      socket.handshake.headers.origin
    );
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { io };
