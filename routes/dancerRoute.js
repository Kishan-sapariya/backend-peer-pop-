import express from "express"
import { protectedRoute } from "../middleware/protectedRoute.js";
import { createDacncerProfile, getDacncerProfileByUsername } from "../controller/dancerController.js";

const router=express.Router();

router.post("/create-profile", protectedRoute, createDacncerProfile);
router.get("/profile/:username", getDacncerProfileByUsername);

export default router;