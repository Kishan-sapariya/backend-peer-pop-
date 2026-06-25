import multer from "multer";

const storage = multer.memoryStorage();

// Max upload size (MB) — configurable via env, defaults to 50MB.
// memoryStorage keeps the whole file in RAM, so this also bounds memory use.
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;

// Mime types we accept across the app: images, videos, and the document
// formats used for GST/PAN verification. Anything else is rejected before
// it ever reaches Cloudinary.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const fileFilter = (req, file, cb) => {
  const mime = file.mimetype || "";
  if (mime.startsWith("image/") || mime.startsWith("video/") || ALLOWED_MIME.has(mime)) {
    return cb(null, true);
  }
  cb(new Error(`Unsupported file type: ${mime}`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

export default upload;
