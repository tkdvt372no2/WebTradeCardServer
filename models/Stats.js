import mongoose from "mongoose";

const statsSchema = new mongoose.Schema({
  users: {
    type: Number,
    default: 0,
  },
  cardsSold: {
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
