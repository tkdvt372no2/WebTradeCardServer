import { catchAsyncError } from "../middlewares/CatchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { Chat, Message } from "../models/Chat.js";
import cloudinary from "cloudinary";
import mongoose from "mongoose";
import getDataUri from "../utils/dataUri.js";

export const createChat = catchAsyncError(async (req, res, next) => {
  const { participants } = req.body;

  if (!participants || participants.length < 2) {
    return next(
      new ErrorHandler("Vui lòng cung cấp ít nhất hai người tham gia", 400)
    );
  }

  const chat = new Chat({ participants });
  await chat.save();

  res.status(201).json({
    success: true,
    chat,
  });
});

export const sendMessage = catchAsyncError(async (req, res, next) => {
  const { chatId, senderId, content } = req.body;
  const file = req.file;

  if (!chatId || !senderId || (!content && !file)) {
    return next(new ErrorHandler("Vui lòng cung cấp đầy đủ thông tin", 400));
  }

  let media = null;

  if (file) {
    const fileUri = getDataUri(file);
    const uploadedMedia = await cloudinary.v2.uploader.upload(fileUri.content, {
      resource_type: file.mimetype.startsWith("image") ? "image" : "video",
    });
    media = {
      url: uploadedMedia.secure_url,
      public_id: uploadedMedia.public_id,
      type: file.mimetype.startsWith("image") ? "image" : "video",
    };
  }

  const message = await Message.create({
    chat: chatId,
    sender: senderId,
    content,
    media,
  });

  res.status(201).json({
    success: true,
    message,
  });
});

export const getMessages = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return next(new ErrorHandler("ID cuộc trò chuyện không hợp lệ", 400));
  }

  const messages = await Message.find({ chat: chatId }).populate(
    "sender",
    "username avatar"
  );

  res.status(200).json({
    success: true,
    messages,
  });
});

export const markAsRead = catchAsyncError(async (req, res, next) => {
  const { messageId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return next(new ErrorHandler("ID tin nhắn không hợp lệ", 400));
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return next(new ErrorHandler("Không tìm thấy tin nhắn", 404));
  }

  message.isRead = true;
  await message.save();

  res.status(200).json({
    success: true,
    message,
  });
});

export const getUserChats = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new ErrorHandler("ID người dùng không hợp lệ", 400));
  }

  const chats = await Chat.find({ participants: userId }).populate(
    "participants",
    "username avatar"
  );

  res.status(200).json({
    success: true,
    chats,
  });
});
