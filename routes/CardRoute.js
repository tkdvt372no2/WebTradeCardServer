import express from "express";
import {
  createCard,
  getAllCards,
  buyCard,
  getCardById,
  sellCard,
  sendCard,
  getUserListings,
  cancelSell,
} from "../controllers/cardController.js";
import singleUpload from "../middlewares/multer.js";
import { authorizeAdmin, isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/cards", getAllCards);

router.get("/card/:id", getCardById);

router.post("/buy-card/:id", isAuthenticated, buyCard);

router.post("/sellCard", isAuthenticated, sellCard);

router.post("/tang-card", isAuthenticated, sendCard);

router.get("/my-listings", isAuthenticated, getUserListings);

router.post("/cancel-sale", isAuthenticated, cancelSell);

router.post(
  "/create-card",
  isAuthenticated,
  authorizeAdmin,
  singleUpload,
  createCard
);

export default router;
