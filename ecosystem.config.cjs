require('dotenv').config();

module.exports={
  apps: [
    {
      name: "backend-peer-pop",
      script: "./index.js", // <-- must be a string path
      watch: false,
      env: {
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        BREVO_API_KEY: process.env.BREVO_API_KEY,
        FRONTEND_URL: process.env.FRONTEND_URL,
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
        YOUTUBE_CALLBACK_URL: process.env.YOUTUBE_CALLBACK_URL,
      },
    },
  ],
};

