import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { catchAsyncError } from "./CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";

export const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return next(new ErrorHandler("Chức năng chỉ dành cho quản trị viên", 403));
  next();
};

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const token =
    req.cookies.token ||
    (req.header("Authorization") &&
      req.header("Authorization").replace("Bearer ", ""));
  if (!token && req.cookies.refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Phiên đăng nhập hết hạn" });
  }
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Bạn chưa đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded._id);
    next();
  } catch (error) {
    if (error) {
      const refreshToken = req.cookies.refreshToken;
      console.log(refreshToken);
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Token hết hạn, vui lòng đăng nhập lại",
        });
      }

      try {
        const decodedRefreshToken = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );
        const user = await User.findById(decodedRefreshToken._id);
        if (!user || user.refreshToken !== refreshToken) {
          return res.status(401).json({
            success: false,
            message: "Refresh token không hợp lệ hoặc người dùng không tồn tại",
          });
        }

        const newToken = user.getJWTToken();
        const newRefreshToken = generateRefreshToken(user._id);

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

        req.user = user;
        next();
      } catch (refreshError) {
        return res.status(401).json({
          success: false,
          message: "Refresh token hết hạn, vui lòng đăng nhập lại",
        });
      }
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Token không hợp lệ" });
    }
  }
});
