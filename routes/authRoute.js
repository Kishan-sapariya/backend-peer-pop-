import express from "express";
import {
  deleteProfilePicture,
  getCurrentUser,
  login,
  logout,
  searchUsers,
  signup,
  uploadCoverImage,
  uploadProfilePicture,
  verifyOtp,
} from "../controller/authController.js";
import { protectedRoute } from "../middleware/protectedRoute.js";
import upload from "../config/multer.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logout);
router.get("/me", protectedRoute, getCurrentUser);
router.post(
  "/upload-image",
  upload.single("image"),
  protectedRoute,
  uploadProfilePicture
);
router.delete("/delete-profile-picture", protectedRoute, deleteProfilePicture);

router.post(
  "/upload-cover-image",
  protectedRoute,
  upload.single("image"),
  uploadCoverImage
);

router.get("/search", protectedRoute, searchUsers);

export default router;
