import cloudinary, {
  streamUpload,
  uploadOptions,
} from "../config/cloudinary.js";
import { canViewProfile } from "../util/isAcceptedConnection.js";
import prisma from "../util/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { calculateProfileCompletion } from "../util/profileConfig.js";
import { deepMerge } from "../util/deepMerge.js";

export const createYoutubeProfile = async (req, res) => {
  const userId = req.user.id;
  const { data } = req.body;

  try {
    const existingProfile = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: userId,
      },
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "YouTube profile already exists for this user",
      });
    }

    const profile = await prisma.creatorProfile.create({
      data: {
        userProfileId: userId,
        creatorType: "YOUTUBER",
        data: data,
      },
    });

    res.status(201).json({ message: "Profile for youtuber created", profile });
  } catch (error) {
    console.error("Error creating YouTube profile:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getYoutubeProfileByUsername = async (req, res) => {
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
        message: "This YouTube profile is private. Connect to view.",
        profile: {
          userProfile: user,
          restricted: true,
        },
      });
    }

    const profile = await prisma.creatorProfile.findFirst({
      where: {
        userProfileId: user.id,
        creatorType: "YOUTUBER",
      },
    });

    if (!profile) {
      return res.status(404).json({
        message: "YouTube profile not found for this user",
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
        completion, // { percentage, category }
      },
    });
  } catch (error) {
    console.error("Error fetching YouTube profile by username:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getYoutubeStats = async (req, res) => {
  const { profileId } = req.params;

  try {
    const stats = await prisma.youTubeStats.findUnique({
      where: { userProfileId: profileId },
    });

    if (!stats) {
      return res
        .status(404)
        .json({ message: "YouTube stats not found for this profile" });
    }

    return res.status(200).json({
      message: "YouTube stats fetched successfully",
      stats,
    });
  } catch (error) {
    console.error("Error fetching YouTube stats:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addRecentContent = async (req, res) => {
  try {
    const { contentType, title, description } = req.body;
    const userProfileId = req.user.id;

    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId },
    });

    if (!creator) {
      return res.status(404).json({ error: "Creator profile not found" });
    }

    const creatorProfileId = creator.id;

    let mediaUrls = [];

    if (contentType === "VIDEO") {
      const video = req.files?.video?.[0];

      if (!video) return res.status(400).json({ error: "Video file missing" });

      const uploadedVideo = await streamUpload(
        video.buffer,
        uploadOptions.video
      );
      mediaUrls.push(uploadedVideo.secure_url);
    } else if (contentType === "SINGLE_IMAGE") {
      const image = req.files?.image?.[0];
      if (!image) return res.status(400).json({ error: "Image file missing" });

      const uploadedImage = await streamUpload(
        image.buffer,
        uploadOptions.image
      );
      mediaUrls.push(uploadedImage.secure_url);
    } else if (contentType === "MULTIPLE_IMAGES") {
      const images = req.files?.images || [];
      if (!images.length)
        return res.status(400).json({ error: "No images uploaded" });

      for (let img of images) {
        const uploaded = await streamUpload(img.buffer, uploadOptions.image);
        mediaUrls.push(uploaded.secure_url);
      }
    }

    const newContent = await prisma.recentContent.create({
      data: {
        creatorProfileId,
        contentType,
        title,
        description,
        mediaUrls,
      },
    });

    return res
      .status(201)
      .json({ message: "Content uploaded successfully", content: newContent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const getRecentContentForProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
      select: { id: true },
    });

    if (!creator) {
      return res.status(404).json({ message: "Creator profile not found" });
    }

    const content = await prisma.recentContent.findMany({
      where: {
        creatorProfileId: creator.id,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Recent content fetched successfully",
      content,
    });
  } catch (error) {
    console.error("Error fetching recent content:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const deleteRecentContentById = async (req, res) => {
  const { contentId } = req.params;
  const creatorId = req.user.id;
  try {
    const user = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: creatorId,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    const content = await prisma.recentContent.findUnique({
      where: {
        id: contentId,
      },
    });
    if (!content) {
      return res.status(404).json({ message: "content not found" });
    }
    if (content.creatorProfileId !== user.id) {
      return res.status(403).json({ message: "Forbidden to delete" });
    }
    await prisma.recentContent.delete({
      where: { id: contentId },
    });
    return res.status(200).json({ message: "content deleted Successfully" });
  } catch (error) {
    console.error("Error fetching recent content:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const addCollaboration = async (req, res) => {
  const { id: userId } = req.user;
  const { collaborations } = req.body;

  try {
    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const collaborationsWithId = (collaborations || []).map((collab) => ({
      id: uuidv4(),
      ...collab,
    }));

    const currentData = user.data || {};
    const mergedData = {
      ...currentData,
      collaborations: [
        ...(currentData.collaborations || []),
        ...collaborationsWithId,
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
      message: "Collaboration added successfully",
      user: {
        ...updatedProfile,
        completion,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCollaboration = async (req, res) => {
  const { collabId } = req.params;
  const { id: userId } = req.user;

  try {
    if (!collabId) {
      return res.status(400).json({ message: "Collab ID is required" });
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

    const currentCollaboration = user.data?.collaborations || [];

    const updatedCollaborations = currentCollaboration.filter(
      (collab) => collab.id !== collabId
    );

    const updatedUser = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: {
        data: {
          ...user.data,
          collaborations: updatedCollaborations,
        },
      },
    });

    return res.status(200).json({
      message: "Collaboration deleted successfully",
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
    const user = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const achievementWithId = (achievements || []).map((achievement) => ({
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
    console.error(error);
    return res.status(500).json({ message: "internal server error" });
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

export const updateYoutubeProfile = async (req, res) => {
  const userId = req.user.id;
  const { data } = req.body;

  try {
    const existingProfile = await prisma.creatorProfile.findFirst({
      where: { userProfileId: userId, creatorType: "YOUTUBER" },
    });

    if (!existingProfile) {
      return res.status(404).json({
        message: "YouTube profile not found for this user",
      });
    }

    const updatedData = deepMerge({ ...existingProfile.data }, data);

    const updatedProfile = await prisma.creatorProfile.update({
      where: { id: existingProfile.id },
      data: {
        data: updatedData,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "YouTube profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating YouTube profile:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
