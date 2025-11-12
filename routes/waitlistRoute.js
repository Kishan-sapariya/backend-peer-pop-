import { Router } from "express";
import { addToWaitlist } from "../controller/waitlistController.js";

const router = Router();

router.post("/", addToWaitlist);

export default router;
