import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const setCookieToken = (res, token) => {
  if (!token) return;

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, 
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    ...(isProduction && { domain: ".peerpop.in" }),
    maxAge: 7 * 24 * 60 * 60 * 1000, 
  };

  res.cookie("token", token, cookieOptions);
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};
