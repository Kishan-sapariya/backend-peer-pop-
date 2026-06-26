import multer from "multer";

const storage = multer.memoryStorage();

// Per-type upload caps (configurable via env).
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB) || 30;
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB) || 100;

// Document formats used for GST/PAN verification (besides images/videos).
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

// multer's single fileSize limit = the largest allowed type (video).
// The stricter image limit is enforced afterwards by enforceTypeLimits.
const baseUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024 },
});

// Runs after multer has parsed the file(s): rejects images over MAX_IMAGE_MB.
// (Videos are already capped at MAX_VIDEO_MB by multer's fileSize limit.)
const enforceTypeLimits = (req, res, next) => {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : []),
  ];

  for (const f of files) {
    const mb = f.size / (1024 * 1024);
    if (f.mimetype?.startsWith("image/") && mb > MAX_IMAGE_MB) {
      return res
        .status(413)
        .json({ message: `Image too large. Maximum size is ${MAX_IMAGE_MB}MB.` });
    }
  }

  next();
};

// Wrap multer's handlers so the per-type size check runs automatically
// (Express flattens the returned middleware array — no route changes needed).
const upload = {
  single: (field) => [baseUpload.single(field), enforceTypeLimits],
  fields: (fields) => [baseUpload.fields(fields), enforceTypeLimits],
  array: (field, max) => [baseUpload.array(field, max), enforceTypeLimits],
  none: () => baseUpload.none(),
};

export default upload;
