import express from "express";
import {
  acceptRequest,
  deleteConnection,
  getConnections,
  rejectRequest,
  sendConnectionReq,
} from "../controller/connectionController.js";
import { protectedRoute } from "../middleware/protectedRoute.js";

const router = express.Router();

router.post("/send-request", protectedRoute, sendConnectionReq);
router.get("/requests", protectedRoute, getConnections);
router.patch("/accept/:connectionId", protectedRoute, acceptRequest);
router.patch("/reject/:connectionId", protectedRoute, rejectRequest);
router.delete("/delete-connection/:connectionId", protectedRoute, deleteConnection);

export default router;
