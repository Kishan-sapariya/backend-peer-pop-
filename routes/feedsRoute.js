import express from "express";
import { protectedRoute } from "../middleware/protectedRoute.js";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getFeedPosts,
  getMyPosts,
  getPostById,
  getPostForMyPeers,
  getSuggestedUsers,
  getUserDetailsForFeed,
  toggelLike,
} from "../controller/feedController.js";
import upload from "../config/multer.js";

const router = express.Router();

router.get("/user-detail", protectedRoute, getUserDetailsForFeed);
router.post(
  "/post",
  protectedRoute,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),

  createPost
);
router.get("/posts", protectedRoute, getFeedPosts);
router.get("/my-posts/:profileId", protectedRoute, getMyPosts);
router.get("/my-peers", protectedRoute, getPostForMyPeers);
router.delete("/posts/:postId", protectedRoute, deletePost);
router.post("/posts/:postId/like", protectedRoute, toggelLike);
router.post("/posts/:postId/comment", protectedRoute, addComment);
router.delete(
  "/posts/:postId/comments/:commentId",
  protectedRoute,
  deleteComment
);
router.get("/posts/:postId", protectedRoute, getPostById);

router.get("/get-suggested-users", protectedRoute, getSuggestedUsers);
export default router;
