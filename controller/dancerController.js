import prisma from "../util/prisma.js";

export const createDacncerProfile = async (req, res) => {
  const { id: userId } = req.user;
  const { data } = req.body;
  try {
    const existingProfile = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: userId,
        creatorType: "DANCER",
      },
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "Dacncer profile already exists for this user",
      });
    }

    const profile = await prisma.creatorProfile.create({
      data: {
        userProfileId: userId,
        creatorType: "DANCER",
        data: data,
      },
    });

    res.status(201).json({ message: "Profile for Dacncer created", profile });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
    console.log(error);
  }
};

export const getDacncerProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Find the user by username
    const user = await prisma.userProfile.findUnique({
      where: { username },
      select: { id: true, email: true, username: true, image: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the creator profile for this user and type
    const profile = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: user.id,
        creatorType: "DANCER",
      },
    });

    if (!profile) {
      return res.status(404).json({
        message: "Dacncer profile not found for this user",
        username,
      });
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      profile: {
        ...profile,
        userProfile: user,
      },
    });
  } catch (error) {
    console.error("Error fetching Dacncer profile by username:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};