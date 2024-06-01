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
  buyCardPack,
} from "../controllers/cardController.js";
import multipleUpload from "../middlewares/multer.js";
import { authorizeAdmin, isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/cards", getAllCards);

router.get("/card/:id", getCardById);

router.post("/buy-card/:id", isAuthenticated, buyCard);

router.post("/sellCard", isAuthenticated, sellCard);

router.post("/tang-card", isAuthenticated, sendCard);

router.get("/my-listings", isAuthenticated, getUserListings);

router.post("/cancel-sale", isAuthenticated, cancelSell);

router.post("/buy-card-pack", isAuthenticated, buyCardPack);

router.post(
  "/create-card",
  isAuthenticated,
  authorizeAdmin,
  multipleUpload,
  createCard
);

export default router;
