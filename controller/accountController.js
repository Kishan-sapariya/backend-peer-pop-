import prisma from "../util/prisma.js";

export const toggleVisibility = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        visibility: user.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
      },
    });

    const { id, username, visibility, image, role } = updatedUser;

    return res.status(200).json({
      message: "Visibility updated",
      user: { id, username, visibility, image, role },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
