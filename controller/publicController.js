import prisma from "../util/prisma.js";

// Public, UNAUTHENTICATED minimal profile info for link previews
// (Open Graph / Twitter cards). Returns only safe, display-level fields so a
// shared profile link renders a rich preview for logged-out viewers and crawlers.
export const getPublicProfileMeta = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { username },
      select: {
        username: true,
        image: true,
        coverImage: true,
        firstName: true,
        lastName: true,
        creatorProfile: { select: { creatorType: true, data: true } },
        businessProfile: { select: { companyName: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const data = user.creatorProfile?.data || {};
    // Nested shape (youtuber/comedian/influencer) vs flat shape (dancer/etc.)
    const personalInfo = data.personalInfo || {};

    const name =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      `${personalInfo.firstName || data.firstName || ""} ${
        personalInfo.lastName || data.lastName || ""
      }`.trim() ||
      user.businessProfile?.companyName ||
      user.username;

    const niche =
      data.contentInfo?.primaryNiche ||
      data.primaryStyle ||
      data.primaryGenre ||
      data.primaryRole ||
      personalInfo.title ||
      "";

    const bio = personalInfo.bio || data.bio || "";

    const creatorType =
      user.creatorProfile?.creatorType ||
      (user.businessProfile ? "BUSINESS" : null);

    return res.status(200).json({
      username: user.username,
      name,
      image: user.image || personalInfo.profileImage || null,
      coverImage: user.coverImage || personalInfo.coverImage || null,
      creatorType,
      niche,
      bio,
    });
  } catch (error) {
    console.error("Error fetching public profile meta:", error);
    res.status(500).json({ message: "Server error" });
  }
};
