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
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Bạn phải đăng nhập để thực hiện hành động này",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded._id);
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    });
  }
});
