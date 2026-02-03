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
import groupRoutes from "./routes/groupRoute.js";
import accountsRoutes from "./routes/accountRoute.js";
import businessRoutes from "./routes/businessRoute.js";
import waitlistRoutes from "./routes/waitlistRoute.js";
import adminRoutes from "./routes/adminRoute.js";
import passport from "./config/passport.js";
import "./cron/updateYoutubeStats.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
	"http://peerpop.in",	
"https://peerpop.in",
      "http://localhost:3000",
      "https://frontend-peer-pop-3f5g.vercel.app",
      "https://www.peerpop.in",
      "https://peerpop.in",
      "http://147.93.31.39",
      "http://147.93.31.39",
      "http://147.93.31.39:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
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
app.use("/api/account", accountsRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/waitlist", waitlistRoutes);

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://frontend-peer-pop-3f5g.vercel.app",
      "https://www.peerpop.in",
      "https://peerpop.in",
      "http://147.93.31.39",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log(
    "🔌 Client connected:",
    socket.id,
    socket.handshake.headers.origin,
  );

  socket.on("join", (userId) => {
    socket.join(userId);
    socket.userId = userId;

    // Add user to online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online status to all connected clients
    io.emit("userOnline", { userId });
    console.log(`✅ User ${userId} joined their room (online)`);
  });

  socket.on("sendMessage", ({ receiverId, message }) => {
    io.to(receiverId).emit("receiveMessage", message);
  });

  // Explicit leave event for immediate offline status (called on logout)
  socket.on("leave", (userId) => {
    if (userId && onlineUsers.has(userId)) {
      onlineUsers.get(userId).delete(socket.id);

      if (onlineUsers.get(userId).size === 0) {
        onlineUsers.delete(userId);
        io.emit("userOffline", { userId });
        console.log(`👋 User ${userId} left (explicit leave)`);
      }
    }
  });

  // Typing indicators
  socket.on("typing", ({ conversationId, receiverId, isTyping }) => {
    console.log(`⌨️ User ${socket.userId} typing: ${isTyping} → to ${receiverId}`);
    io.to(receiverId).emit("userTyping", {
      conversationId,
      userId: socket.userId,
      isTyping
    });
  });

  // Mark messages as read
  socket.on("markAsRead", ({ conversationId, userId, lastReadAt }) => {
    // Notify other participants that messages were read
    socket.to(conversationId).emit("messagesRead", {
      conversationId,
      userId,
      lastReadAt
    });
  });

  // Get online status for specific users
  socket.on("getOnlineUsers", (userIds, callback) => {
    const onlineStatus = {};
    if (Array.isArray(userIds)) {
      userIds.forEach(userId => {
        onlineStatus[userId] = onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
      });
    }
    console.log(`📊 Online status check:`, onlineStatus);
    if (typeof callback === 'function') {
      callback(onlineStatus);
    }
  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (userId && onlineUsers.has(userId)) {
      onlineUsers.get(userId).delete(socket.id);

      // If user has no more active connections, mark as offline
      if (onlineUsers.get(userId).size === 0) {
        onlineUsers.delete(userId);
        io.emit("userOffline", { userId });
        console.log(`❌ User ${userId} is now offline`);
      }
    }
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { io };

