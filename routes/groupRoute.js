import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  commentOnGroupPost,
  createGroup,
  createPost,
  deleteGroup,
  deleteGroupComment,
  deleteGroupPost,
  fetchFourGroups,
  fetchGroupById,
  fetchGroupPosts,
  fetchJoinedGroup,
  joinGroup,
  leaveGroup,
  likeGroupPost,
  updateGroup,
  uploadImage,
} from "../controller/groupController.js";
import upload from "../config/multer.js";

const router = express.Router();

router.post("/create-group", protectedRoute, createGroup);
router.post("/join-group/:groupId", protectedRoute, joinGroup);
router.post(
  "/:groupId/posts",
  protectedRoute,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  createPost
);

router.post("/:groupId/posts/:postId/like", protectedRoute, likeGroupPost);
router.post(
  "/:groupId/posts/:postId/comment",
  protectedRoute,
  commentOnGroupPost
);
router.delete(
  "/:groupId/posts/:postId/comments/:commentId",
  protectedRoute,
  deleteGroupComment
);
router.delete("/:groupId/posts/:postId", protectedRoute, deleteGroupPost);

router.get("/", protectedRoute, fetchFourGroups);

router.get("/joined-groups", protectedRoute, fetchJoinedGroup);

router.delete("/leave-group/:groupId", protectedRoute, leaveGroup);
router.delete("/delete-group/:groupId", protectedRoute, deleteGroup);

router.patch("/update-group/:groupId", protectedRoute, updateGroup);
router.patch(
  "/update-image/:groupId",
  protectedRoute,
  upload.single("image"),
  uploadImage
);

router.get("/:groupId", protectedRoute, fetchGroupById);
router.get("/:groupId/posts", protectedRoute, fetchGroupPosts);

export default router;
