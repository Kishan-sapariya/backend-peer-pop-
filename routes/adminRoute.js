import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import { adminRoute } from "../middleware/adminRoute.js";
import {
  getWaitlist,
  updateWaitlistStatus,
  deleteWaitlistEntry,
  getBusinessesForVerification,
  updateBusinessStatus,
} from "../controller/adminController.js";

const router = express.Router();

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
