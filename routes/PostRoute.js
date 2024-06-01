import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  createPost,
  getAllPosts,
  getPostDetails,
  updatePost,
  deletePost,
  addComment,
  likePost,
  likeComment, // Thêm hàm likeComment
  replyComment,
  clearReadNotifications,
  readNotification,
  tagUser,
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/postController.js";
import multipleUpload from "../middlewares/multer.js";

const router = express.Router();

router.post("/posts", isAuthenticated, multipleUpload, createPost);
router.get("/posts", getAllPosts);
router.get("/posts/:id", getPostDetails);
router.put("/posts/:id", isAuthenticated, updatePost);
router.delete("/posts/:id", isAuthenticated, deletePost);

router.post("/posts/:id/comments", isAuthenticated, multipleUpload, addComment);
router.post(
  "/posts/:id/comments/reply",
  isAuthenticated,
  multipleUpload,
  replyComment
);

// Thêm route cho việc like comment/reply
router.put(
  "/posts/:postId/comments/:commentId/like",
  isAuthenticated,
  likeComment
);
router.put(
  "/posts/:postId/comments/:commentId/replies/:replyId/like",
  isAuthenticated,
  likeComment
);

router.put("/posts/:id/like", isAuthenticated, likePost);

router.post("/notifications/clear", isAuthenticated, clearReadNotifications);
router.get(
  "/notifications/:notificationId/read",
  isAuthenticated,
  readNotification
);

router.post("/tags", isAuthenticated, tagUser);

router.post("/categories", isAuthenticated, createCategory);
router.get("/categories", getAllCategories);
router.put("/categories/:id", isAuthenticated, updateCategory);
router.delete("/categories/:id", isAuthenticated, deleteCategory);

export default router;
