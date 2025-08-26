import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  deleteNotification,
  getNotifications,
  markAsRead,
} from "../controller/notificationController.js";

const router = express.Router();

router.get("/all", protectedRoute, getNotifications);
router.delete("/delete/:notificationId", protectedRoute, deleteNotification);
router.patch("/read/:notificationId", protectedRoute, markAsRead);

export default router;
