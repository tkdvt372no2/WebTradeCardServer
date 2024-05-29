import mongoose from "mongoose";

const statsSchema = new mongoose.Schema({
  users: {
    type: Number,
    default: 0,
  },
  cardsSoldSystem: {
    type: Number,
    default: 0,
  },
  cardsTraded: {
    type: Number,
    default: 0,
  },
  totalCoinsDeposited: {
    type: Number,
    default: 0,
  },
  totalCoinsTransacted: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Stats = mongoose.model("Stats", statsSchema);
