import express from "express";
import {
  createChat,
  sendMessage,
  getMessages,
  markAsRead,
  getUserChats,
} from "../controllers/chatController.js";
import { isAuthenticated } from "../middlewares/auth.js";
import multipleUpload from "../middlewares/multer.js";

const router = express.Router();

router.post("/create", isAuthenticated, createChat);
router.post("/send-message", isAuthenticated, multipleUpload, sendMessage);
router.get("/messages/:chatId", isAuthenticated, getMessages);
router.put("/mark-as-read/:messageId", isAuthenticated, markAsRead);
router.get("/user-chats/:userId", isAuthenticated, getUserChats);

export default router;
