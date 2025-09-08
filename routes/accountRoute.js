import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import { toggleVisibility } from "../controller/accountController.js";

const router = express.Router();

router.patch("/visibility", protectedRoute, toggleVisibility);

export default router;
