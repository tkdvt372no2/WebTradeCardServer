import app from "./app.js";
import { connectDb } from "./config/database.js";
import cloudinary from "cloudinary";
import nodeCron from "node-cron";
import { Stats } from "./models/Stats.js";
import http from "http";
import { Server } from "socket.io";
import PayOS from "@payos/node";
import { updateCardPricesRandomly } from "./controllers/cardController.js";

connectDb();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLIENT_NAME,
  api_key: process.env.CLOUDINARY_CLIENT_API,
  api_secret: process.env.CLOUDINARY_CLIENT_SECRET,
});

export const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Kết nối socket thành công");
});

export const sendNotification = (notification) => {
  io.emit("notification", notification);
};

nodeCron.schedule("0 0 0 1 * *", async () => {
  try {
    await Stats.create({});
  } catch (error) {
    console.log(error);
  }
});

nodeCron.schedule("0 0 * * *", updateCardPricesRandomly);

server.listen(process.env.PORT, () => {
  console.log("Server listening on port " + process.env.PORT);
});
