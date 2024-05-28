import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Card",
    required: true,
  },
  price: {
    type: Number,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  transactionType: {
    type: String,
    enum: ["direct", "resale", "gift"],
    default: "direct",
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
});

export const Transaction = mongoose.model("Transaction", transactionSchema);
