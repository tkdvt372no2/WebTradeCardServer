export const sendToken = async (res, user, message, statusCode = 200) => {
  const token = user.getJWTToken();
  const refreshToken = user.generateRefreshToken();

  await user.save();

  const tokenOptions = {
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

  res.cookie("token", token, tokenOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenOptions);

  res.status(statusCode).json({
    success: true,
    message,
    user,
  });
};
