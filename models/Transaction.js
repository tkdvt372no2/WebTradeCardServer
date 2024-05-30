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
    required: false,
  },
  price: {
    type: Number,
    required: false,
  },
  amount: {
    type: Number,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  transactionType: {
    type: String,
    enum: ["direct", "resale", "gift", "transfer","buypack"],
    default: "direct",
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
});

export const Transaction = mongoose.model("Transaction", transactionSchema);
