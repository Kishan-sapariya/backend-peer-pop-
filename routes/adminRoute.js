import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import { adminRoute } from "../middleware/adminRoute.js";
import {
  getBusinessesForVerification,
  updateBusinessStatus,
} from "../controller/adminController.js";

const router = express.Router();

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
