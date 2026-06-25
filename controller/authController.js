import bcrypt from "bcrypt";
import crypto from "crypto";
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
    const {
      username,
      email,
      password,
      role,
      companyName,
      industry,
      companySize,
    } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["CREATOR", "BUSINESS"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (role === "BUSINESS") {
      const personalDomains = [
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "aol.com",
        "icloud.com",
        "protonmail.com",
        "zoho.com",
      ];
      const domain = email.split("@")[1].toLowerCase();

      if (personalDomains.includes(domain)) {
        return res.status(400).json({
          message: "Please use a valid company email (not a personal email).",
        });
      }
    }

    const existingUser = await prisma.userProfile.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // Cryptographically secure 6-digit OTP (Math.random is predictable).
    const generateOtp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await prisma.userProfile.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        otp: generateOtp,
        otpExpiry,
      },
    });

    if (role === "BUSINESS") {
      await prisma.businessProfile.create({
        data: {
          userProfileId: newUser.id,
          companyName,
          industry,
          size: companySize,
        },
      });
    }

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
      // Never return the raw record — it contains the bcrypt hash and the live OTP.
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
      success: true,
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
        role: updateUserProfile.role,
      },
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
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { email },
      include: { creatorProfile: true, businessProfile: true },
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res
        .status(403)
        .json({ success: false, message: "Please verify your email" });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    setCookieToken(res, token);

    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      image: user.image || null,
      creatorType: user.creatorProfile?.creatorType || null,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      redirect: "/feed",
      user: userPayload,
    });
  } catch (error) {
    console.error("🔥 Login error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      domain: isProduction ? ".peerpop.in" : undefined,
    });
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
        businessProfile: true,
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
        visibility: user.visibility,
        role: user.role,
        companyName: user.businessProfile?.companyName,
        isAdmin: user.isAdmin,
        isFounder: user.isFounder,
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
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        coverImage: true,
        role: true,
        visibility: true,
        isAdmin: true,
        isFounder: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
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
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        coverImage: true,
        role: true,
        visibility: true,
        isAdmin: true,
        isFounder: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
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
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        coverImage: true,
        role: true,
        visibility: true,
        isAdmin: true,
        isFounder: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
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
        { username: { startsWith: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        {
          creatorProfile: {
            is: { data: { path: ["firstName"], string_starts_with: q } },
          },
        },
        {
          creatorProfile: {
            is: { data: { path: ["firstName"], string_contains: q } },
          },
        },
        {
          creatorProfile: {
            is: { data: { path: ["lastName"], string_starts_with: q } },
          },
        },
        {
          creatorProfile: {
            is: { data: { path: ["lastName"], string_contains: q } },
          },
        },
        {
          businessProfile: {
            is: { companyName: { contains: q, mode: "insensitive" } },
          },
        }
      );

      const creatorTypes = [
        "YOUTUBER",
        "COMEDIAN",
        "INFLUENCER",
        "MUSICIAN",
        "DANCER",
        "PHOTOGRAPHER",
        "PODCASTER",
        "ACTOR",
      ];

      const matchingTypes = creatorTypes.filter((type) =>
        type.toLowerCase().includes(q.toLowerCase())
      );

      if (matchingTypes.length > 0) {
        OR.push({
          creatorProfile: {
            is: {
              creatorType: { in: matchingTypes },
            },
          },
        });
      }
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

    // 🔎 Filter by location 
    if (location) {
      const locations = Array.isArray(location)
        ? location
        : location.split(",");

      AND.push({
        OR: locations.map((loc) => ({
          OR: [
            {
              creatorProfile: {
                is: {
                  data: {
                    path: ["personalInfo", "state"],
                    string_contains: loc,
                    mode: "insensitive",
                  },
                },
              },
            },
            // Search in city
            {
              creatorProfile: {
                is: {
                  data: {
                    path: ["personalInfo", "city"],
                    string_contains: loc,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              creatorProfile: {
                is: {
                  data: {
                    path: ["personalInfo", "customCity"],
                    string_contains: loc,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
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
        isFounder: true,
        creatorProfile: {
          select: {
            id: true,
            creatorType: true,
            data: true,
          },
        },
        businessProfile: {
          select: {
            id: true,
            companyName: true,
            industry: true,
            size: true,
            headquarters: true,
          },
        },
        founderProfile: {
          select: {
            id: true,
            headline: true,
            location: true,
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
