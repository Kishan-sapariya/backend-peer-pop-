import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  createConversation,
  getAllConversations,
  getConversation,
  getMessages,
  sendMessages,
  uploadAttachment,
} from "../controller/conversationController.js";
import upload from "../config/multer.js";

const router = express.Router();

//conversation routes
router.post("/create", protectedRoute, createConversation);
router.get("/get/:conversationId", protectedRoute, getConversation);
router.get("/get/", protectedRoute, getAllConversations);

// messages routes
router.post(
  "/upload-attachment",
  upload.single("file"),
  uploadAttachment
);

router.post("/send-message/:conversationId", protectedRoute, sendMessages);
router.get("/get-messages/:conversationId", protectedRoute, getMessages);

export default router;
