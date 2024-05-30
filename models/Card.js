import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  seller: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    default: "Chưa bán",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Vui lòng nhập tên thẻ"],
  },
  totalInit: {
    type: Number,
    default: 10000,
  },
  total: {
    type: Number,
    default: 100,
  },
  stt: {
    type: String,
  },
  description: {
    type: String,
    required: [true, "Vui lòng nhập mô tả thẻ"],
  },
  type: {
    type: String,
    default: "Đấu sĩ",
  },
  image: {
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  price: {
    type: Number,
    default: 1000,
  },
  tier: {
    type: Number,
    default: 1,
  },
  listings: [listingSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Card = mongoose.model("Card", schema);
