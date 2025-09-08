import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  deleteBusinessAchievement,
  deleteBusinessService,
  getBusinessProfileDetailsByUsername,
  postBusinessDetails,
  reuploadBusinessDocuments,
  updateBusinessAchievements,
  updateBusinessBasicInfo,
  updateBusinessServices,
  updateSocials,
} from "../controller/businessController.js";
import upload from "../config/multer.js";

const router = express.Router();

router.patch(
  "/update-business-profile",
  protectedRoute,
  upload.fields([
    { name: "gstFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
  ]),
  postBusinessDetails
);
router.get(
  "/get-business-profile/:username",
  protectedRoute,
  getBusinessProfileDetailsByUsername
);

router.patch("/update-basic-info", protectedRoute, updateBusinessBasicInfo);
router.patch("/update-socials", protectedRoute, updateSocials);

router.patch(
  "/reupload-docs",
  protectedRoute,
  upload.fields([
    { name: "gstFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
  ]),
  reuploadBusinessDocuments
);

router.patch("/update-services", protectedRoute, updateBusinessServices);

router.patch(
  "/update-achievements",
  protectedRoute,
  updateBusinessAchievements
);

router.delete("/services/:index", protectedRoute, deleteBusinessService);

router.delete(
  "/achievements/:index",
  protectedRoute,
  deleteBusinessAchievement
);

export default router;
