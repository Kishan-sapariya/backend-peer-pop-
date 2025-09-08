import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const uploadOptions = {
  video: {
    resource_type: "video",
    folder: "recent-content/videos",
    allowed_formats: ["mp4", "mov", "avi", "webm"],
    transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
    eager: [
      {
        width: 640,
        height: 360,
        crop: "pad",
        quality: "auto:good",
        format: "mp4",
      },
    ],
    eager_async: true,
  },
  image: {
    resource_type: "image",
    folder: "recent-content/images",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
    eager: [
      { width: 800, height: 600, crop: "limit" },
      { width: 400, height: 300, crop: "thumb" },
    ],
  },
  document: {
    resource_type: "auto",
    folder: "recent-content/documents",
    allowed_formats: [
      "pdf",
      "doc",
      "docx",
      "txt",
      "ppt",
      "pptx",
      "xls",
      "xlsx",
      "png",
      "jpg",
      "jpeg",
    ],
  },
};

export const streamUpload = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

export const getCloudinaryPublicId = (url) => {
  if (!url) return null;

  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    const afterUpload = url.substring(uploadIndex + 8);
    const parts = afterUpload.split("/");

    if (parts[0].startsWith("v") && !isNaN(parts[0].substring(1))) {
      parts.shift();
    }

    const last = parts.pop();
    const filename = last.split(".")[0];

    return [...parts, filename].join("/");
  } catch (err) {
    console.error("Error extracting public_id:", err);
    return null;
  }
};

export default cloudinary;
