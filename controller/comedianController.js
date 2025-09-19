import { canViewProfile } from "../util/isAcceptedConnection.js";
import prisma from "../util/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { calculateProfileCompletion } from "../util/profileConfig.js";

export const createComedianProfile = async (req, res) => {
  const { id: userId } = req.user;
  const { data } = req.body;
  try {
    const existingProfile = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: userId,
        creatorType: "COMEDIAN",
      },
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "Comedian profile already exists for this user",
      });
    }

    const profile = await prisma.creatorProfile.create({
      data: {
        userProfileId: userId,
        creatorType: "COMEDIAN",
        data: data,
      },
    });

    res.status(201).json({ message: "Profile for comedian created", profile });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
    console.log(error);
  }
};

export const getComedianProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const { id: requesterId } = req.user;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        image: true,
        coverImage: true,
        visibility: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isAllowed = await canViewProfile(requesterId, user);

    if (!isAllowed) {
      return res.status(200).json({
        message: "This Comedian profile is private. Connect to view.",
        profile: {
          userProfile: user,
          restricted: true,
        },
      });
    }

    const profile = await prisma.creatorProfile.findFirst({
      where: {
        userProfileId: user.id,
        creatorType: "COMEDIAN",
      },
    });

    if (!profile) {
      return res.status(404).json({
        message: "Comedian profile not found for this user",
        username,
      });
    }

    const completion = calculateProfileCompletion(
      profile.creatorType,
      profile.data
    );

    res.status(200).json({
      message: "Profile retrieved successfully",
      profile: {
        ...profile,
        userProfile: user,
        restricted: false,
        completion,
      },
    });
  } catch (error) {
    console.error("Error fetching Comedian profile by username:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addUpcomingShows = async (req, res) => {
  const { id: userId } = req.user;
  const { upcomingShows } = req.body;

  try {
    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
      include: { userProfile: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentData = user.data || {};

    const upcomingShowWithId = (upcomingShows || []).map((show) => ({
      id: uuidv4(),
      ...show,
    }));

    const mergedData = {
      ...currentData,
      upcomingShows: [
        ...(currentData.upcomingShows || []),
        ...upcomingShowWithId,
      ],
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: { data: mergedData },
      include: { userProfile: true },
    });

    const completion = calculateProfileCompletion(
      updatedProfile.creatorType,
      updatedProfile.data
    );

    return res.status(200).json({
      message: "Upcoming show added successfully",
      user: {
        ...updatedProfile,
        completion,
      },
    });
  } catch (error) {
    console.error("Error Adding upcoming shows:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteShow = async (req, res) => {
  const { upcomingShowId } = req.params;
  const { id: userId } = req.user;

  try {
    if (!upcomingShowId) {
      return res.status(400).json({ message: "upcoming show ID is required" });
    }

    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentShows = user.data?.upcomingShows || [];

    const updatedShows = currentShows.filter(
      (show) => show.id !== upcomingShowId
    );

    const updatedUser = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: {
        data: {
          ...user.data,
          upcomingShows: updatedShows,
        },
      },
    });

    return res.status(200).json({
      message: "show deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addRecentSets = async (req, res) => {
  const { id: userId } = req.user;
  const { recentSets } = req.body;
  try {
    const user = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: userId,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentData = user.data || {};

    const recentSetsWithId = (recentSets || []).map((set) => ({
      id: uuidv4(),
      ...set,
    }));

    const mergedData = {
      ...currentData,
      recentSets: [...(currentData.recentSets || []), ...recentSetsWithId],
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: { data: mergedData },
    });

    return res.status(200).json({
      message: "Recent set added successfully",
      user: updatedProfile,
    });
  } catch (error) {
    console.error("Error Adding recent set:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteRecentSets = async (req, res) => {
  const { recentSetsId } = req.params;
  const { id: userId } = req.user;

  try {
    if (!recentSetsId) {
      return res.status(400).json({ message: "recent sets ID is required" });
    }

    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentSets = user.data?.recentSets || [];

    const updatedSets = currentSets.filter((sets) => sets.id !== recentSetsId);

    const updatedUser = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: {
        data: {
          ...user.data,
          recentSets: updatedSets,
        },
      },
    });

    return res.status(200).json({
      message: "Set deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addAchievement = async (req, res) => {
  const { id: userId } = req.user;
  const { achievements } = req.body;

  try {
    if (!Array.isArray(achievements)) {
      return res.status(400).json({ message: "Achievements must be an array" });
    }

    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
      include: { userProfile: true }, // include userProfile
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const achievementWithId = achievements.map((achievement) => ({
      id: uuidv4(),
      ...achievement,
    }));

    const currentData = user.data || {};
    const mergedData = {
      ...currentData,
      achievements: [...(currentData.achievements || []), ...achievementWithId],
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: { data: mergedData },
      include: { userProfile: true }, 
    });

    const completion = calculateProfileCompletion(
      updatedProfile.creatorType,
      updatedProfile.data
    );

    return res.status(200).json({
      message: "Achievement added successfully",
      user: {
        ...updatedProfile,
        completion, 
      },
    });
  } catch (error) {
    console.error("Error adding achievement:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAchievement = async (req, res) => {
  const { achievementId } = req.params;
  const { id: userId } = req.user;

  try {
    if (!achievementId) {
      return res.status(400).json({ message: "Achievement ID is required" });
    }

    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== user.userProfileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentAchievement = user.data?.achievements || [];

    const updatedAchievement = currentAchievement.filter(
      (achievement) => achievement.id !== achievementId
    );

    const updatedUser = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: {
        data: {
          ...user.data,
          achievements: updatedAchievement,
        },
      },
    });

    return res.status(200).json({
      message: "Achievement deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateComedianProfile = async (req, res) => {
  const userId = req.user.id;
  const { data } = req.body;

  try {
    const existingProfile = await prisma.creatorProfile.findFirst({
      where: {
        userProfileId: userId,
        creatorType: "COMEDIAN",
      },
    });

    if (!existingProfile) {
      return res.status(404).json({
        message: "Comedian profile not found. Please create one first.",
      });
    }

    // merge old data + new data (shallow merge)
    const updatedData = {
      ...existingProfile.data,
      ...data,
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { id: existingProfile.id },
      data: {
        data: updatedData,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      message: "Comedian profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating Comedian profile:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
