import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  try {
    const token = jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    console.log("✅ Token generated:", {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenPreview: token.substring(0, 15) + "...", 
      length: token.length,
    });
    return token;
  } catch (error) {
    console.error("❌ Token generation error:", error);
  }
};

export const setCookieToken = (res, token) => {
  if (!token) {
    console.warn("⚠️ Tried to set cookie with empty token");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    domain: isProduction ? ".peerpop.in" : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  console.log("🍪 Cookie set:", {
    domain: isProduction ? ".peerpop.in" : "localhost",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    tokenPreview: token.substring(0, 15) + "...",
  });
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 Token verified:", {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
      exp: new Date(decoded.exp * 1000).toISOString(),
    });
    return decoded;
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    return null;
  }
};
