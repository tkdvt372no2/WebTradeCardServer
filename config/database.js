import mongoose from "mongoose";

export const connectDb = async () => {
  const { connection } = await mongoose.connect(process.env.MONGO_URI);
  mongoose.set("strictQuery", true);
  console.log(`Kết nối database thành công: ${connection.host}`);
};
