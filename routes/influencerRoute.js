import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  addCampaigns,
  addRecentContent,
  createInfluencerProfile,
  deleteCampaign,
  deleteRecentContent,
  getInfluencerProfileByUsername,
  updateInfluencerProfile,
} from "../controller/influencerController.js";
import upload from "../config/multer.js";

const router = express.Router();

router.post("/create-profile", protectedRoute, createInfluencerProfile);
router.get(
  "/profile/:username",
  protectedRoute,
  getInfluencerProfileByUsername
);
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

router.post("/delete-recent-content/:id", protectedRoute, deleteRecentContent);
router.post("/add-campaign", protectedRoute, addCampaigns);
router.delete("/delete-campaign/:campaignId", protectedRoute, deleteCampaign);
router.patch("/update-profile", protectedRoute, updateInfluencerProfile);


export default router;
