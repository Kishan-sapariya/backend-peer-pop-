import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  createGroup,
  deleteGroup,
  fetchAllGroups,
  updateGroup,
} from "../controller/groupController.js";

const router = express.Router();

router.get("/", fetchAllGroups);
router.post("/create-group", protectedRoute, createGroup);
router.delete("/delete-group/:groupId", protectedRoute, deleteGroup);
router.delete("/update-group/:groupId", protectedRoute, updateGroup);

export default router;
