import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { User } from "../models/User.js";
import { FriendRequest } from "../models/FriendRequest.js";
import { sendNotification } from "../utils/socket.js";

export const sendFriendRequest = catchAsyncError(async (req, res, next) => {
  const { recipientId } = req.body;
  console.log(recipientId);

  const existingRequest = await FriendRequest.findOne({
    requester: req.user._id,
    recipient: recipientId,
  });

  if (existingRequest) {
    return next(new ErrorHandler("Yêu cầu kết bạn đã tồn tại", 400));
  }

  const friendRequest = await FriendRequest.create({
    requester: req.user._id,
    recipient: recipientId,
  });

  const user = await User.findById(req.user._id).select("name username avatar");

  sendNotification(
    {
      type: "friendRequest",
      message: `${user.username} đã gửi cho bạn một yêu cầu kết bạn.`,
      from: {
        id: user._id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
      },
    },
    recipientId
  );

  res.status(201).json({
    success: true,
    message: "Yêu cầu kết bạn đã được gửi",
    friendRequest,
  });
});

export const respondToFriendRequest = catchAsyncError(
  async (req, res, next) => {
    const { requestId, status } = req.body;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return next(new ErrorHandler("Yêu cầu kết bạn không tồn tại", 404));
    }

    if (friendRequest.recipient.toString() !== req.user._id.toString()) {
      return next(
        new ErrorHandler("Bạn không có quyền xử lý yêu cầu này", 403)
      );
    }

    let messageStatus = `Yêu cầu kết bạn đã được ${status}`;
    if (status === "chấp nhận") {
      await User.findByIdAndUpdate(req.user._id, {
        $push: { friends: friendRequest.requester },
      });

      await User.findByIdAndUpdate(friendRequest.requester, {
        $push: { friends: req.user._id },
      });

      const user = await User.findById(req.user._id).select(
        "name username avatar"
      );

      sendNotification(
        {
          type: "friendRequestAccepted",
          message: `${user.username} đã chấp nhận lời mời kết bạn của bạn.`,
          from: {
            id: user._id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
          },
        },
        friendRequest.requester
      );
    } else {
      messageStatus = "Yêu cầu của bạn bị từ chối";
    }

    await friendRequest.deleteOne();

    res.status(200).json({
      success: true,
      message: messageStatus,
    });
  }
);

export const getFriends = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate(
    "friends",
    "name username avatar"
  );

  res.status(200).json({
    success: true,
    friends: user.friends,
  });
});

export const getFriendRequests = catchAsyncError(async (req, res, next) => {
  const friendRequests = await FriendRequest.find({
    recipient: req.user._id,
  }).populate("requester", "name username avatar");

  res.status(200).json({
    success: true,
    friendRequests,
  });
});

export const unfriend = catchAsyncError(async (req, res, next) => {
  const { friendId } = req.body;

  if (!friendId) {
    return next(new ErrorHandler("Vui lòng cung cấp ID của bạn bè", 400));
  }

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { friends: friendId },
  });

  await User.findByIdAndUpdate(friendId, {
    $pull: { friends: req.user._id },
  });

  res.status(200).json({
    success: true,
    message: "Đã hủy kết bạn",
  });
});

export const cancelFriendRequest = catchAsyncError(async (req, res, next) => {
  const { requestId } = req.body;

  const friendRequest = await FriendRequest.findOne({
    _id: requestId,
    requester: req.user._id,
  });

  if (!friendRequest) {
    return next(new ErrorHandler("Yêu cầu kết bạn không tồn tại", 404));
  }

  await friendRequest.deleteOne();

  res.status(200).json({
    success: true,
    message: "Đã hủy yêu cầu kết bạn",
  });
});

