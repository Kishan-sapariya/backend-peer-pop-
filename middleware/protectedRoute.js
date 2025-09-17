import { verifyToken } from "../util/generateToken.js";
import prisma from "../util/prisma.js";

export const protectedRoute = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; 
    next();
  } catch (error) {
    console.log("Protected route error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};