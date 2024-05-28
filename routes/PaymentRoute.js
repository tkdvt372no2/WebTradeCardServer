import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  createPaymentLink,
  getCardTransactionsByWalletAddress,
  getUserCardTransactions,
  getUserTransactions,
  webhookConfirm,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/buycard-link", isAuthenticated, createPaymentLink);
router.post("/webhook", isAuthenticated, webhookConfirm);
router.get("/transactions", isAuthenticated, getUserTransactions);
router.get("/card-transactions", isAuthenticated, getUserCardTransactions);
router.get("/card-transactions/:walletAddress", getCardTransactionsByWalletAddress);
export default router;
