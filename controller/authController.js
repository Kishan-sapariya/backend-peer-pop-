import bcrypt from "bcrypt";
import prisma from "../util/prisma.js";
import { sendOTP } from "../util/sendEmail.js";
import { generateToken, setCookieToken } from "../util/generateToken.js";
import cloudinary, {
  getCloudinaryPublicId,
  streamUpload,
  uploadOptions,
} from "../config/cloudinary.js";

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }
    const existingUser = await prisma.userProfile.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const generateOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await prisma.userProfile.create({
      data: {
        username,
        email,
        password: hashedPassword,
        otp: generateOtp,
        otpExpiry,
      },
    });

    try {
      sendOTP(email, generateOtp);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "Error sending OTP", success: false });
    }

    return res.status(200).json({
      message: `OTP sent to ${email}`,
      user: newUser,
      success: true,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false });
    console.log(error);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await prisma.userProfile.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({ id: user.id, email: user.email });

    setCookieToken(res, token);

    return res.status(200).json({
      message: "Login successful",
      success: true,
      user: {
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        creatorType: user.creatorProfile?.creatorType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false });
    console.log(error);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.userProfile.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(401).json({ message: "Invalid OTP or OTP expired" });
    }

    const updateUserProfile = await prisma.userProfile.update({
      where: { email },
      data: {
        emailVerified: true,
        otp: null,
        otpExpiry: null,
      },
    });
    const token = generateToken({
      id: updateUserProfile.id,
      email: updateUserProfile.email,
    });

    setCookieToken(res, token);

    return res.status(200).json({
      message: "Otp verified successfully",
      success: true,
      user: {
        username: updateUserProfile.username,
        email: updateUserProfile.email,
        emailVerified: updateUserProfile.emailVerified,
        firstName: updateUserProfile.firstName,
        lastName: updateUserProfile.lastName,
        createdAt: updateUserProfile.createdAt,
        creatorType: user.creatorProfile?.creatorType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false });
    console.log(error);
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(error);
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.userProfile.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        creatorProfile: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        image: user.image,
        coverImage: user.coverImage,
        creatorType: user.creatorProfile?.creatorType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(error);
  }
};

export const uploadProfilePicture = async (req, res) => {
  const { id: userId } = req.user;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }
    const user = await prisma.userProfile.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.image) {
      const publicId = getCloudinaryPublicId(user.image);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }
    }
    const uploadedImage = await streamUpload(req.file.buffer, {
      ...uploadOptions.image,
      folder: "user-profile-pictures",
    });
    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: { image: uploadedImage.secure_url },
    });

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(error);
  }
};

export const deleteProfilePicture = async (req, res) => {
  const { id: userId } = req.user;
  try {
    const user = await prisma.userProfile.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.image) {
      return res.status(404).json({ message: "Image not found" });
    }

    if (user.image) {
      const publicId = getCloudinaryPublicId(user.image);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }
    }
    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: { image: null },
    });

    res.status(200).json({
      message: "Profile picture deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(error);
  }
};

export const uploadCoverImage = async (req, res) => {
  const { id: userId } = req.user;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }
    const user = await prisma.userProfile.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.coverImage) {
      const publicId = getCloudinaryPublicId(user.coverImage);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }
    }
    const uploadedImage = await streamUpload(req.file.buffer, {
      ...uploadOptions.image,
      folder: "user-cover-images",
    });
    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: { coverImage: uploadedImage.secure_url },
    });

    res.status(200).json({
      message: "Cover image uploaded successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(error);
  }
};

export async function searchUsers(req, res) {
  try {
    const { q, creatorType, location, cursor, limit = 10 } = req.query;

    const take = Math.min(parseInt(limit) || 10, 50);

    const OR = [];
    const AND = [];

    if (q && q.trim()) {
      OR.push(
        // username starts with "q"
        { username: { startsWith: q, mode: "insensitive" } },

        // username contains "q" anywhere
        { username: { contains: q, mode: "insensitive" } },

        // firstName starts with "q"
        {
          creatorProfile: {
            is: { data: { path: ["firstName"], string_starts_with: q } },
          },
        },
        // firstName contains "q"
        {
          creatorProfile: {
            is: { data: { path: ["firstName"], string_contains: q } },
          },
        },

        // lastName starts with "q"
        {
          creatorProfile: {
            is: { data: { path: ["lastName"], string_starts_with: q } },
          },
        },
        // lastName contains "q"
        {
          creatorProfile: {
            is: { data: { path: ["lastName"], string_contains: q } },
          },
        }
      );
    }

    if (creatorType) {
      const types = Array.isArray(creatorType)
        ? creatorType
        : creatorType.split(",");

      AND.push({
        creatorProfile: {
          is: {
            creatorType: { in: types },
          },
        },
      });
    }

    if (location) {
      const locations = Array.isArray(location)
        ? location
        : location.split(",");

      AND.push({
        OR: locations.map((loc) => ({
          creatorProfile: {
            is: {
              data: {
                path: ["personalInfo", "location"],
                string_contains: loc,
                mode: "insensitive",
              },
            },
          },
        })),
      });
    }

    const where = {};
    if (OR.length) where.OR = OR;
    if (AND.length) where.AND = AND;

    const users = await prisma.userProfile.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: String(cursor) } : undefined,
      orderBy: { id: "desc" },
      select: {
        id: true,
        username: true,
        image: true,
        creatorProfile: {
          select: {
            id: true,
            creatorType: true,
            data: true,
          },
        },
      },
    });

    const nextCursor =
      users.length === take ? users[users.length - 1].id : null;

    res.json({ users, nextCursor });
  } catch (error) {
    console.error("Error in searchUsers:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
}
