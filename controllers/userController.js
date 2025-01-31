import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { User } from "../models/User.js";
import { sendToken } from "../utils/sendToken.js";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto";
import cloudinary from "cloudinary";
import getDataUri from "../utils/dataUri.js";
import { Stats } from "../models/Stats.js";
import { getRandomCards, updateCardTotals } from "./cardController.js";
import { Transaction } from "../models/Transaction.js";
import jwt from "jsonwebtoken";

export const refreshToken = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Refresh token không tồn tại" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token không hợp lệ hoặc người dùng không tồn tại",
      });
    }

    const newToken = user.getJWTToken();
    const newRefreshToken = user.generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    const options = {
      expires: new Date(Date.now() + 30 * 60 * 1000),
      httpOnly: true,
      sameSite: "none",
      secure: true,
    };

    const refreshTokenOptions = {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: "none",
      secure: true,
    };

    res.cookie("token", newToken, options);
    res.cookie("refreshToken", newRefreshToken, refreshTokenOptions);

    res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Refresh token hết hạn, vui lòng đăng nhập lại",
    });
  }
};

export const Register = catchAsyncError(async (req, res, next) => {
  const { name, email, password, username } = req.body;
  const file = req.file;
  if (!name || !email || !password || !username || !file)
    return next(new ErrorHandler("Vui lòng nhập đầy đủ thông tin!", 400));

  let user = await User.findOne({ email });
  if (user) {
    return next(new ErrorHandler("Tài khoản của bạn đã tồn tại", 409));
  }

  user = await User.findOne({ username });
  if (user) {
    return next(new ErrorHandler("Tên người dùng đã tồn tại", 409));
  }

  const fileUri = getDataUri(file);
  const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);
  const randomCards = await getRandomCards();

  user = await User.create({
    name,
    email,
    password,
    username,
    avatar: {
      public_id: mycloud.public_id,
      url: mycloud.secure_url,
    },
    myCard: randomCards.map((card) => ({
      card: card._id,
      image: card.image.url,
      name: card.name,
    })),
  });

  await updateCardTotals(randomCards);
  await user.populate({
    path: "myCard.card",
    select: "price tier",
  });
  sendToken(res, user, "Đăng ký thành công", 201);
});

export const Login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new ErrorHandler("Vui lòng nhập đầy đủ thông tin!", 400));
  let user = await User.findOne({ email }).select("+password").populate({
    path: "myCard.card",
    select: "price tier",
  });
  if (!user) {
    return next(new ErrorHandler("Tài khoản không tồn tại", 409));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    return next(new ErrorHandler("Email hoặc mật khẩu không chính xác", 401));
  sendToken(res, user, `Chào mừng bạn trở lại, ${user.name}`, 200);
});

export const findUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const Logout = catchAsyncError(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded._id);

    if (user) {
      user.refreshToken = null;
      await user.save();
    }
  }

  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite: "none",
      secure: true,
    })
    .cookie("refreshToken", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite: "none",
      secure: true,
    })
    .json({
      success: true,
      message: "Đăng xuất thành công!",
    });
});

export const getMyProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate({
    path: "myCard.card",
    select: "price tier",
  });

  res.status(200).json({
    success: true,
    user,
  });
});

export const changePassword = catchAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return next(new ErrorHandler("Vui lòng nhập đầy đủ thông tin", 400));
  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch)
    return next(new ErrorHandler("Mật khẩu cũ không chính xác", 400));
  user.password = newPassword;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Đổi mật khẩu thành công",
  });
});

export const updateProfile = catchAsyncError(async (req, res, next) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (email) user.email = email;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Cập nhật hồ sơ thành công",
  });
});

export const updateProfilePicture = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const file = req.file;
  const fileUri = getDataUri(file);
  await cloudinary.v2.uploader.destroy(user.avatar.public_id);
  const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);
  user.avatar = {
    public_id: mycloud.public_id,
    url: mycloud.secure_url,
  };
  await user.save();
  res.status(200).json({
    success: true,
    message: "Cập nhật ảnh đại diện thành công",
  });
});

export const forgetPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new ErrorHandler("Không tìm thấy tài khoản", 400));
  const resetToken = user.getResetToken();

  await user.save();
  const url = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const message = `Nhấn vào link để đặt lại mật khẩu: ${url}. Nếu bạn không có yêu cầu gì hãy bỏ qua.`;

  await sendEmail(user.email, "Đặt lại mật khẩu", message);

  res.status(200).json({
    success: true,
    message: `Reset Token đã được gửi đến ${user.email}`,
  });
});

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user)
    return next(new ErrorHandler("Token không đúng hoặc hết hạn", 401));
  user.password = req.body.password;
  user.resetPasswordExpire = undefined;
  user.resetPasswordToken = undefined;

  await user.save();
  res.status(200).json({
    success: true,
    message: "Đặt lại mật khẩu thành công",
  });
});

export const deleteMyProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  await cloudinary.v2.uploader.destroy(user.avatar.public_id);

  await user.remove();
  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
    })
    .json({
      success: true,
      message: "Xoá hồ sơ thành công",
    });
});

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const users = await User.find({});
  res.status(200).json({
    success: true,
    users,
  });
});

export const updateUserRole = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(ErrorHandler("Không tìm thấy tài khoản", 404));
  if (user.role === "user") user.role = "admin";
  else user.role = "user";
  await user.save();

  res.status(200).json({
    success: true,
    message: "Thay đổi thành công",
  });
});

export const deleteUser = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(ErrorHandler("Không tìm thấy tài khoản", 404));
  await cloudinary.v2.uploader.destroy(user.avatar.public_id);

  await user.remove();
  res.status(200).json({
    success: true,
    message: "Xoá tài khoản thành công",
  });
});

export const transferCoins = catchAsyncError(async (req, res, next) => {
  const { diaChiViNguoiNhan, amount } = req.body;

  if (!diaChiViNguoiNhan || !amount) {
    return next(new ErrorHandler("Vui lòng cung cấp đầy đủ thông tin", 400));
  }

  const sender = await User.findById(req.user._id);
  const nguoiNhan = await User.findOne({ addressWallet: diaChiViNguoiNhan });

  if (!nguoiNhan) {
    return next(new ErrorHandler("Không tìm thấy tài khoản người nhận", 404));
  }

  if (sender.coin < amount) {
    return next(new ErrorHandler("Số dư không đủ để chuyển", 400));
  }

  sender.coin -= amount;
  nguoiNhan.coin += amount;

  await sender.save();
  await nguoiNhan.save();
  await Transaction.create({
    sender: sender._id,
    recipient: nguoiNhan._id,
    amount,
    transactionType: "transfer",
  });

  res.status(200).json({
    success: true,
    message: "Chuyển coin thành công",
    senderCoin: sender.coin,
    nguoiNhanCoin: nguoiNhan.coin,
  });
});

export const getAdminStats = catchAsyncError(async (req, res, next) => {
  const stats = await Stats.find({}).sort({ createdAt: "desc" }).limit(12);

  const latestStats = stats[0];

  const usersCount = latestStats?.users || 0;
  const cardsSoldSystemCount = latestStats?.cardsSoldSystem || 0;
  const cardsTradedCount = latestStats?.cardsTraded || 0;
  const totalCoinsDepositedCount = latestStats?.totalCoinsDeposited || 0;
  const totalCoinsTransactedCount = latestStats?.totalCoinsTransacted || 0;

  const previousStats = stats[1] || {};

  const calculatePercentage = (current, previous) => {
    if (previous === 0 || !previous) return 100;
    return (((current - previous) / previous) * 100).toFixed(2);
  };

  const usersPercentage = calculatePercentage(usersCount, previousStats.users);
  const cardsSoldSystemPercentage = calculatePercentage(
    cardsSoldSystemCount,
    previousStats.cardsSoldSystem
  );
  const cardsTradedPercentage = calculatePercentage(
    cardsTradedCount,
    previousStats.cardsTraded
  );
  const totalCoinsDepositedPercentage = calculatePercentage(
    totalCoinsDepositedCount,
    previousStats.totalCoinsDeposited
  );
  const totalCoinsTransactedPercentage = calculatePercentage(
    totalCoinsTransactedCount,
    previousStats.totalCoinsTransacted
  );

  const usersProfit = usersPercentage >= 0;
  const cardsSoldSystemProfit = cardsSoldSystemPercentage >= 0;
  const cardsTradedProfit = cardsTradedPercentage >= 0;
  const totalCoinsDepositedProfit = totalCoinsDepositedPercentage >= 0;
  const totalCoinsTransactedProfit = totalCoinsTransactedPercentage >= 0;

  res.status(200).json({
    success: true,
    stats,
    usersCount,
    cardsSoldSystemCount,
    cardsTradedCount,
    totalCoinsDepositedCount,
    totalCoinsTransactedCount,
    usersPercentage,
    cardsSoldSystemPercentage,
    cardsTradedPercentage,
    totalCoinsDepositedPercentage,
    totalCoinsTransactedPercentage,
    usersProfit,
    cardsSoldSystemProfit,
    cardsTradedProfit,
    totalCoinsDepositedProfit,
    totalCoinsTransactedProfit,
  });
});

User.watch().on("change", async () => {
  try {
    const stats = await Stats.find({}).sort({ createdAt: "desc" }).limit(1);
    const usersCount = await User.countDocuments({ role: "user" });

    if (stats.length > 0) {
      stats[0].users = usersCount;
      stats[0].createdAt = new Date(Date.now());
      await stats[0].save();
    } else {
      await Stats.create({ users: usersCount });
    }
  } catch (error) {
    console.error("Không thể cập nhật thống kê:", error);
  }
});
