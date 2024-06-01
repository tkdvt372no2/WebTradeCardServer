import multer from "multer";

const storage = multer.memoryStorage();
const multipleUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array("files", 10);

export default multipleUpload;

export const singleUpload = multer({ storage }).single("file");
