import prisma from "../util/prisma.js";

import cloudinary, {
  getCloudinaryPublicId,
  streamUpload,
  uploadOptions,
} from "../config/cloudinary.js";
import { v4 as uuidv4 } from "uuid";
import { canViewProfile } from "../util/isAcceptedConnection.js";
import { calculateProfileCompletion } from "../util/profileConfig.js";

export const createInfluencerProfile = async (req, res) => {
  const { id: userId } = req.user;
  const { data } = req.body;
  try {
    const existingProfile = await prisma.creatorProfile.findUnique({
      where: {
        userProfileId: userId,
        creatorType: "INFLUENCER",
      },
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "Influencer profile already exists for this user",
      });
    }

    const profile = await prisma.creatorProfile.create({
      data: {
        userProfileId: userId,
        creatorType: "INFLUENCER",
        data: data,
      },
    });

    res
      .status(201)
      .json({ message: "Profile for INFLUENCER created", profile });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
    console.log(error);
  }
};

export const getInfluencerProfileByUsername = async (req, res) => {
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
        message: "This Influencer profile is private. Connect to view.",
        profile: {
          userProfile: user,
          restricted: true,
        },
      });
    }

    const profile = await prisma.creatorProfile.findFirst({
      where: {
        userProfileId: user.id,
        creatorType: "INFLUENCER",
      },
    });

    if (!profile) {
      return res.status(404).json({
        message: "Influencer profile not found for this user",
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
    console.error("Error fetching Influencer profile by username:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addRecentContent = async (req, res) => {
  try {
    const { title, description, contentType } = req.body;
    const userProfileId = req.user.id;

    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId },
    });

    if (!creator) {
      return res.status(404).json({ error: "Creator profile not found" });
    }

    const creatorProfileId = creator.id;
    let mediaUrls = [];

    const ct = contentType || "";
    if (ct === "VIDEO") {
      const video = req.files?.video?.[0];
      if (!video) return res.status(400).json({ error: "Video file missing" });
      const uploaded = await streamUpload(video.buffer, uploadOptions.video);
      mediaUrls.push(uploaded.secure_url);
    } else if (ct === "SINGLE_IMAGE") {
      const image = req.files?.image?.[0];
      if (!image) return res.status(400).json({ error: "Image file missing" });
      const uploaded = await streamUpload(image.buffer, uploadOptions.image);
      mediaUrls.push(uploaded.secure_url);
    } else if (ct === "MULTIPLE_IMAGES") {
      const images = req.files?.images || [];
      if (!images.length)
        return res.status(400).json({ error: "No images uploaded" });
      for (const img of images) {
        const uploaded = await streamUpload(img.buffer, uploadOptions.image);
        mediaUrls.push(uploaded.secure_url);
      }
    }

    const currentData =
      creator.data && typeof creator.data === "object" ? creator.data : {};

    const existingRecentContent = Array.isArray(currentData.recentContent)
      ? currentData.recentContent
      : [];

    const newRecentItem = {
      id: uuidv4(),
      title: title || "",
      description: description || "",
      contentType: ct || null,
      mediaUrls,
      createdAt: new Date().toISOString(),
    };

    const updatedData = {
      ...currentData,
      recentContent: [...existingRecentContent, newRecentItem],
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: {
        data: updatedData,
      },
    });

    return res.status(201).json({
      message: "Recent content added to data JSON",
      recentContent: newRecentItem,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("addRecentContent error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const deleteRecentContent = async (req, res) => {
  try {
    const { id } = req.params;
    const userProfileId = req.user.id;

    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId },
    });

    if (!creator) {
      return res.status(404).json({ error: "Creator profile not found" });
    }

    const currentData =
      creator.data && typeof creator.data === "object" ? creator.data : {};

    const existingRecentContent = Array.isArray(currentData.recentContent)
      ? currentData.recentContent
      : [];

    const contentToDelete = existingRecentContent.find(
      (item) => item.id === id
    );
    if (!contentToDelete) {
      return res.status(404).json({ error: "Recent content not found" });
    }

    // Destroy each media file from Cloudinary
    if (
      Array.isArray(contentToDelete.mediaUrls) &&
      contentToDelete.mediaUrls.length
    ) {
      for (const url of contentToDelete.mediaUrls) {
        const publicId = getCloudinaryPublicId(url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            resource_type:
              contentToDelete.contentType === "VIDEO" ? "video" : "image",
          });
        }
      }
    }

    const updatedRecentContent = existingRecentContent.filter(
      (item) => item.id !== id
    );

    const updatedData = {
      ...currentData,
      recentContent: updatedRecentContent,
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { id: creator.id },
      data: { data: updatedData },
    });

    return res.status(200).json({
      message: "Recent content deleted successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("deleteRecentContent error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const addCampaigns = async (req, res) => {
  const { id: userId } = req.user;
  const { campaigns } = req.body;

  try {
    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!creator) {
      return res.status(404).json({ message: "Creator profile not found" });
    }

    if (creator.userProfileId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentData = creator.data || {};

    const campaignArray = Array.isArray(campaigns)
      ? campaigns
      : [campaigns].filter(Boolean);

    const campaignsWithId = campaignArray.map((campaign) => ({
      id: uuidv4(),
      ...campaign,
    }));

    const updatedData = {
      ...currentData,
      campaigns: [...(currentData.campaigns || []), ...campaignsWithId],
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: { data: updatedData },
    });

    return res.status(200).json({
      message: "Campaigns added successfully",
      campaigns: updatedProfile.data.campaigns,
    });
  } catch (error) {
    console.error("addCampaigns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCampaign = async (req, res) => {
  const { id: userId } = req.user;
  const { campaignId } = req.params;

  try {
    const creator = await prisma.creatorProfile.findUnique({
      where: { userProfileId: userId },
    });

    if (!creator) {
      return res.status(404).json({ message: "Creator profile not found" });
    }

    if (creator.userProfileId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentData = creator.data || {};

    const updatedCampaigns = (currentData.campaigns || []).filter(
      (c) => c.id !== campaignId
    );

    if (updatedCampaigns.length === (currentData.campaigns || []).length) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const updatedData = {
      ...currentData,
      campaigns: updatedCampaigns,
    };

    const updatedProfile = await prisma.creatorProfile.update({
      where: { userProfileId: userId },
      data: { data: updatedData },
    });

    return res.status(200).json({
      message: "Campaign deleted successfully",
      campaigns: updatedProfile.data.campaigns,
    });
  } catch (error) {
    console.error("deleteCampaign error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInfluencerProfile = async (req, res) => {
  const userId = req.user.id;
  const { data } = req.body;

  try {
    const existingProfile = await prisma.creatorProfile.findFirst({
      where: {
        userProfileId: userId,
        creatorType: "INFLUENCER",
      },
    });

    if (!existingProfile) {
      return res.status(404).json({
        message: "influencer profile not found. Please create one first.",
      });
    }

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
      message: "influencer profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating influencer profile:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
