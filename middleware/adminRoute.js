export const adminRoute = (req, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
  } catch (error) {
    console.log("Admin route error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
