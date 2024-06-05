import { Server } from "socket.io";
import cloudinary from "cloudinary";
import { Message } from "../models/Chat.js";
import getDataUri from "./dataUri.js";
import { Notification } from "./../models/Notification.js";

let io;
const userSockets = new Map(); 

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Kết nối socket thành công");

    socket.on("joinRoom", (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} connected with socket id ${socket.id}`);
    });

    socket.on("disconnect", () => {
      // Remove userId when socket disconnects
      for (let [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
    });

    socket.on("sendMessage", async ({ chatId, senderId, content, file }) => {
      let media = null;
      if (file) {
        const fileUri = getDataUri(file);
        const uploadedMedia = await cloudinary.v2.uploader.upload(
          fileUri.content,
          {
            resource_type: file.mimetype.startsWith("image")
              ? "image"
              : "video",
          }
        );
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
      io.to(chatId).emit("newMessage", message);
    });

    socket.on("readMessage", async ({ messageId, readerId }) => {
      const message = await Message.findById(messageId);
      if (message) {
        message.isRead = true;
        await message.save();

        io.to(message.chat).emit("messageRead", { messageId, readerId });
      }
    });
  });

  return io;
};

export const sendNotification = (notification, recipientId) => {
  const socketId = userSockets.get(recipientId.toString());
  console.log(
    `Sending notification to ${recipientId} with socket id ${socketId}`
  );
  if (socketId) {
    io.to(socketId).emit("notification", notification);
  }
};

export const createNotification = async (
  userId,
  fromUserId,
  message,
  type,
  targetId
) => {
  if (String(userId) === String(fromUserId)) {
    return;
  }

  const notification = new Notification({
    user: userId,
    from: fromUserId,
    message,
    type,
    targetId,
  });
  await notification.save();
  const populatedNotification = await Notification.findById(
    notification._id
  ).populate("from", "name username avatar");
  sendNotification(populatedNotification, userId);
};
