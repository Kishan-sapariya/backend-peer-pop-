import express from "express"
import { protectedRoute } from "../middleware/protectedRoute.js";
import { createFilmMakerProfile, getFilmMakerProfileByUsername } from "../controller/filmMakerController.js";

const router=express.Router();

router.post("/create-profile", protectedRoute, createFilmMakerProfile);
router.get("/profile/:username", getFilmMakerProfileByUsername);

export default router;