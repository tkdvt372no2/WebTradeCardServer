import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import validator from "validator";
import bcrypt from "bcrypt";
import crypto from "crypto";

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Vui lòng nhập tên của bạn"],
  },
  username: {
    type: String,
    required: [true, "Vui lòng nhập tên người dùng"],
    unique: true,
  },
  email: {
    type: String,
    required: [true, "Vui lòng nhập email của bạn"],
    unique: true,
    validate: validator.isEmail,
  },
  addressWallet: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Vui lòng nhập mật khẩu của bạn"],
    minLength: [6, "Mật khẩu tối thiểu 6 kí tự"],
    select: false,
  },
  role: {
    type: String,
    enum: ["admin", "user"],
    default: "user",
  },
  avatar: {
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  coin: {
    type: Number,
    default: 0,
  },
  myCard: [
    {
      card: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card",
      },
      image: String,
      name: String,
      total: {
        type: Number,
        default: 1,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: String,
  resetPasswordExpire: String,
});

schema.methods.getJWTToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15d",
    }
  );
};

schema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);

  if (!this.addressWallet) {
    const uniqueAddressWallet = crypto.randomBytes(5).toString("hex");
    this.addressWallet = uniqueAddressWallet;
    const encryptedAddressWallet = crypto
      .createHash("sha256")
      .update(uniqueAddressWallet)
      .digest("hex");
    this.addressWallet = encryptedAddressWallet;
  }
  next();
});

schema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

schema.methods.getResetToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  return resetToken;
};

export const User = mongoose.model("User", schema);
