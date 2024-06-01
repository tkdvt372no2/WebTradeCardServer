import express from "express";
import {
  Login,
  Logout,
  Register,
  changePassword,
  deleteMyProfile,
  deleteUser,
  findUserByUsername,
  forgetPassword,
  getAdminStats,
  getAllUsers,
  getMyProfile,
  resetPassword,
  transferCoins,
  updateProfile,
  updateProfilePicture,
  updateUserRole,
} from "../controllers/userController.js";
import { authorizeAdmin, isAuthenticated } from "../middlewares/auth.js";
import multipleUpload from "../middlewares/multer.js";
const router = express.Router();

router.post("/register", multipleUpload, Register);

router.route("/transfer-coins").post(isAuthenticated, transferCoins);

router.get("/user/:username", isAuthenticated, findUserByUsername);

router.post("/login", Login);

router.get("/logout", Logout);

router.get("/me", isAuthenticated, getMyProfile);

router.delete("/me", isAuthenticated, deleteMyProfile);

router.put("/change-password", isAuthenticated, changePassword);

router.put("/update-profile", isAuthenticated, updateProfile);

router.put(
  "/update-profile-picture",
  isAuthenticated,
  multipleUpload,
  updateProfilePicture
);

router.post("/forget-password", forgetPassword);

router.put("/reset-password/:token", resetPassword);

router.get("/admin/stats", isAuthenticated, authorizeAdmin, getAdminStats);

router.get("/admin/users", getAllUsers);

router.put("/admin/user/:id", isAuthenticated, authorizeAdmin, updateUserRole);

router.delete("/admin/user/:id", isAuthenticated, authorizeAdmin, deleteUser);

export default router;
