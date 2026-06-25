import prisma from "../util/prisma.js";
import cloudinary, {
  streamUpload,
  uploadOptions,
  getCloudinaryPublicId,
} from "../config/cloudinary.js";

// Public: fetch the founder profile by username (with media + milestones)
export const getFounderProfileByUsername = async (req, res) => {
  const { username } = req.params;
  try {
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await prisma.userProfile.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        image: true,
        coverImage: true,
        visibility: true,
        isFounder: true,
        founderProfile: {
          include: {
            media: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isFounder) {
      return res
        .status(404)
        .json({ message: "This user is not a founder" });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching founder profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Founder-only: create/update the text, socials, and milestones of the profile
export const updateFounderProfile = async (req, res) => {
  try {
    if (!req.user?.isFounder) {
      return res
        .status(403)
        .json({ message: "Only the founder can edit this profile" });
    }

    const loggedInUserId = req.user.id;
    const {
      headline,
      bio,
      location,
      website,
      linkedinUrl,
      twitterUrl,
      instagramUrl,
      youtubeUrl,
      milestones,
    } = req.body;

    // milestones may arrive as a JSON string (multipart) or an array (json body)
    let parsedMilestones = milestones;
    if (typeof milestones === "string") {
      try {
        parsedMilestones = JSON.parse(milestones);
      } catch {
        parsedMilestones = undefined;
      }
    }
    if (parsedMilestones !== undefined && !Array.isArray(parsedMilestones)) {
      return res.status(400).json({ message: "milestones must be an array" });
    }

    const fields = {
      headline: headline ?? undefined,
      bio: bio ?? undefined,
      location: location ?? undefined,
      website: website ?? undefined,
      linkedinUrl: linkedinUrl ?? undefined,
      twitterUrl: twitterUrl ?? undefined,
      instagramUrl: instagramUrl ?? undefined,
      youtubeUrl: youtubeUrl ?? undefined,
      milestones: parsedMilestones ?? undefined,
    };

    const profile = await prisma.founderProfile.upsert({
      where: { userProfileId: loggedInUserId },
      update: fields,
      create: { userProfileId: loggedInUserId, ...fields },
      include: { media: { orderBy: { createdAt: "desc" } } },
    });

    return res.status(200).json({
      success: true,
      message: "Founder profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Error updating founder profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Founder-only: upload a gallery image or showcase video
export const uploadFounderMedia = async (req, res) => {
  try {
    if (!req.user?.isFounder) {
      return res
        .status(403)
        .json({ message: "Only the founder can upload media" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const type = (req.body.type || "IMAGE").toUpperCase();
    if (!["IMAGE", "VIDEO"].includes(type)) {
      return res.status(400).json({ message: "type must be IMAGE or VIDEO" });
    }

    const loggedInUserId = req.user.id;

    // Ensure a founder profile row exists to attach media to
    const founderProfile = await prisma.founderProfile.upsert({
      where: { userProfileId: loggedInUserId },
      update: {},
      create: { userProfileId: loggedInUserId },
    });

    const options = {
      ...(type === "VIDEO" ? uploadOptions.video : uploadOptions.image),
      folder: type === "VIDEO" ? "founder/videos" : "founder/images",
    };
    const result = await streamUpload(req.file.buffer, options);

    const media = await prisma.founderMedia.create({
      data: {
        founderProfileId: founderProfile.id,
        type,
        url: result.secure_url,
        caption: req.body.caption || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      media,
    });
  } catch (error) {
    console.error("Error uploading founder media:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Founder-only: delete a piece of media (also removes it from Cloudinary)
export const deleteFounderMedia = async (req, res) => {
  try {
    if (!req.user?.isFounder) {
      return res
        .status(403)
        .json({ message: "Only the founder can delete media" });
    }

    const { id } = req.params;
    const loggedInUserId = req.user.id;

    const media = await prisma.founderMedia.findUnique({
      where: { id },
      include: { founderProfile: { select: { userProfileId: true } } },
    });

    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    if (media.founderProfile.userProfileId !== loggedInUserId) {
      return res.status(403).json({ message: "Not your media" });
    }

    const publicId = getCloudinaryPublicId(media.url);
    if (publicId) {
      await cloudinary.uploader
        .destroy(publicId, {
          resource_type: media.type === "VIDEO" ? "video" : "image",
        })
        .catch((e) => console.error("Cloudinary destroy failed:", e));
    }

    await prisma.founderMedia.delete({ where: { id } });

    return res
      .status(200)
      .json({ success: true, message: "Media deleted successfully" });
  } catch (error) {
    console.error("Error deleting founder media:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
