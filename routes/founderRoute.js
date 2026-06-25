import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import upload from "../config/multer.js";
import {
  getFounderProfileByUsername,
  updateFounderProfile,
  uploadFounderMedia,
  deleteFounderMedia,
} from "../controller/founderController.js";

const router = express.Router();

router.get("/profile/:username", protectedRoute, getFounderProfileByUsername);
router.patch("/update-profile", protectedRoute, updateFounderProfile);
router.post(
  "/media",
  protectedRoute,
  upload.single("file"),
  uploadFounderMedia
);
router.delete("/media/:id", protectedRoute, deleteFounderMedia);

export default router;
