import express from "express";
import { getPublicProfileMeta } from "../controller/publicController.js";

const router = express.Router();

// Public (no auth) — minimal profile data for link previews.
router.get("/profile/:username", getPublicProfileMeta);

export default router;
