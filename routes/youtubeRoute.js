import express from "express";
import {
  addAchievement,
  addCollaboration,
  addRecentContent,
  createYoutubeProfile,
  deleteAchievement,
  deleteCollaboration,
  deleteRecentContentById,
  getRecentContentForProfile,
  getYoutubeProfileByUsername,
  getYoutubeStats,
} from "../controller/youtubeController.js";
import { protectedRoute } from "../middleware/protectedRoute.js";
import upload from "../config/multer.js";

const router = express.Router();

router.post("/create-profile", protectedRoute, createYoutubeProfile);
router.get("/profile/:username", protectedRoute, getYoutubeProfileByUsername);
router.get("/stats", protectedRoute, getYoutubeStats);
router.post(
  "/recent-content",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  protectedRoute,
  addRecentContent
);
router.get("/recent-content", protectedRoute, getRecentContentForProfile);
router.delete(
  "/recent-content/:contentId",
  protectedRoute,
  deleteRecentContentById
);
router.patch("/add-collaboration", protectedRoute, addCollaboration);
router.delete(
  "/delete-collaboration/:collabId",
  protectedRoute,
  deleteCollaboration
);
router.patch("/add-achievement", protectedRoute, addAchievement);
router.delete(
  "/delete-achievement/:achievementId",
  protectedRoute,
  deleteAchievement
);

export default router;
