import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  addAchievement,
  addRecentSets,
  addUpcomingShows,
  createComedianProfile,
  deleteAchievement,
  deleteRecentSets,
  deleteShow,
  getComedianProfileByUsername,
} from "../controller/comedianController.js";

const router = express.Router();

router.post("/create-profile", protectedRoute, createComedianProfile);
router.get("/profile/:username", protectedRoute,getComedianProfileByUsername);
router.post("/add-upcoming-show", protectedRoute, addUpcomingShows);
router.delete("/delete-show/:upcomingShowId", protectedRoute, deleteShow);
router.post("/add-recent-sets", protectedRoute, addRecentSets);
router.delete("/delete-sets/:recentSetsId", protectedRoute, deleteRecentSets);
router.patch("/add-achievement", protectedRoute, addAchievement);
router.delete(
  "/delete-achievement/:achievementId",
  protectedRoute,
  deleteAchievement
);

export default router;
