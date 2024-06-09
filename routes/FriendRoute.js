import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  sendFriendRequest,
  respondToFriendRequest,
  getFriendRequests,
  getFriends,
  unfriend,
  cancelFriendRequest,
} from "../controllers/friendController.js";

const router = express.Router();

router.post("/send-friend-request", isAuthenticated, sendFriendRequest);
router.post("/respond-friend-request", isAuthenticated, respondToFriendRequest);
router.get("/friend-requests", isAuthenticated, getFriendRequests);
router.get("/friends", isAuthenticated, getFriends);
router.post("/unfriend", isAuthenticated, unfriend);
router.post("/cancel-friend-request", isAuthenticated, cancelFriendRequest);

export default router;
