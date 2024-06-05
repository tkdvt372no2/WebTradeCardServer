import express from "express";
import { config } from "dotenv";
import ErrorMiddleware from "./middlewares/Error.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import user from "./routes/UserRoute.js";
import payment from "./routes/PaymentRoute.js";
import card from "./routes/CardRoute.js";
import post from "./routes/PostRoute.js";
import chat from "./routes/ChatRoute.js";
import { saveAllChampionsToDB } from "./config/getalltuong.js";
config({
  path: "./config/config.env",
});
const app = express();
saveAllChampionsToDB();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use("/api/v1", user);
app.use("/api/v1", payment);
app.use("/api/v1", card);
app.use("/api/v1", post);
app.use("/api/v1", chat);
app.use("/", (req, res) => {
  res.send({ message: "Duong Van Tuan" });
});
app.use(ErrorMiddleware);
export default app;
