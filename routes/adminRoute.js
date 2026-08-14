import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import { adminRoute } from "../middleware/adminRoute.js";
import {
  getWaitlist,
  updateWaitlistStatus,
  deleteWaitlistEntry,
  getBusinessesForVerification,
  updateBusinessStatus,
  getWaitlistStats,
  getUsers,
  getUserStats,
  setFounder,
  sendWelcomeMailToUser,
  getRecipients,
  sendBulkEmail,
} from "../controller/adminController.js";

const router = express.Router();

// Dashboard stats (protected + admin only)
router.get("/waitlist/stats", protectedRoute, adminRoute, getWaitlistStats);
router.get("/users/stats", protectedRoute, adminRoute, getUserStats);
router.get("/users", protectedRoute, adminRoute, getUsers);
router.patch("/users/:id/founder", protectedRoute, adminRoute, setFounder);
router.post(
  "/users/:id/welcome-email",
  protectedRoute,
  adminRoute,
  sendWelcomeMailToUser
);

// Admin email composer
router.get("/recipients", protectedRoute, adminRoute, getRecipients);
router.post("/send-email", protectedRoute, adminRoute, sendBulkEmail);

// Waitlist routes (protected + admin only)
router.get("/waitlist", protectedRoute, adminRoute, getWaitlist);
router.patch(
  "/waitlist/:id/status",
  protectedRoute,
  adminRoute,
  updateWaitlistStatus
);
router.delete("/waitlist/:id", protectedRoute, adminRoute, deleteWaitlistEntry);

// Business verification routes
router.get(
  "/businesses-verification",
  protectedRoute,
  adminRoute,
  getBusinessesForVerification
);

router.patch(
  "/business/:businessId/status",
  protectedRoute,
  adminRoute,
  updateBusinessStatus
);

export default router;
