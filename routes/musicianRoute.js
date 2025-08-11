import express from "express"
import { protectedRoute } from "../middleware/protectedRoute.js";
import { createMusicianProfile, getMusicianProfileByUsername } from "../controller/musicianController.js";

const router=express.Router();

router.post("/create-profile", protectedRoute, createMusicianProfile);
router.get("/profile/:username", getMusicianProfileByUsername);

export default router;