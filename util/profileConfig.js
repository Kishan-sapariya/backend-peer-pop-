// Profile completeness → tier (Rising / Elite / Pro)
//
// The tier reflects how complete a creator's profile is: the more meaningful
// fields they've filled, the higher the tier. Each type lists weighted fields
// (essential = 3, important = 2, bonus = 1) grouped into sections, plus a
// human label used to tell the user exactly what's still missing.
//
// Field paths are relative to the stored `creatorProfile.data`. Youtuber,
// comedian and influencer store a NESTED shape (personalInfo.*, statistics.*);
// dancer, musician, filmmaker and business store a FLAT shape.

const f = (path, label, weight, section) => ({ path, label, weight, section });

export const PROFILE_FIELDS = {
  YOUTUBER: [
    f("personalInfo.firstName", "First name", 3, "Basics"),
    f("personalInfo.lastName", "Last name", 2, "Basics"),
    f("personalInfo.bio", "Bio", 3, "Basics"),
    f("personalInfo.location", "Location", 2, "Basics"),
    f("personalInfo.website", "Website", 1, "Basics"),
    f("personalInfo.phone", "Phone", 1, "Basics"),
    f("channelInfo.channelName", "Channel name", 3, "Channel"),
    f("channelInfo.channelHandle", "Channel handle", 2, "Channel"),
    f("statistics.subscriberCount", "Subscriber count", 3, "Stats"),
    f("statistics.totalViews", "Total views", 2, "Stats"),
    f("statistics.videoCount", "Video count", 1, "Stats"),
    f("contentInfo.primaryNiche", "Primary niche", 3, "Content"),
    f("contentInfo.contentCategories", "Content categories", 2, "Content"),
    f("contentInfo.contentStyle", "Content style", 1, "Content"),
    f("contentInfo.uploadFrequency", "Upload frequency", 1, "Content"),
    f("socialMedia.links.instagram", "Instagram link", 1, "Social"),
    f("business.rates", "Rates", 1, "Business"),
  ],

  COMEDIAN: [
    f("personalInfo.firstName", "First name", 3, "Basics"),
    f("personalInfo.lastName", "Last name", 2, "Basics"),
    f("personalInfo.bio", "Bio", 3, "Basics"),
    f("personalInfo.location", "Location", 2, "Basics"),
    f("personalInfo.stageName", "Stage name", 2, "Basics"),
    f("personalInfo.website", "Website", 1, "Basics"),
    f("personalInfo.phone", "Phone", 1, "Basics"),
    f("comedyCareer.yearsPerforming", "Years performing", 3, "Career"),
    f("comedyCareer.comedyStyle", "Comedy style", 3, "Career"),
    f("comedyCareer.showsPerformed", "Shows performed", 2, "Career"),
    f("comedyCareer.primaryVenues", "Primary venues", 1, "Career"),
    f("performanceDetails.setLength", "Set length", 1, "Performance"),
    f("performanceDetails.travelWillingness", "Travel willingness", 1, "Performance"),
    f("socialMedia.links.instagram", "Instagram link", 2, "Social"),
    f("socialMedia.links.youtube", "YouTube link", 1, "Social"),
    f("business.rates", "Rates", 1, "Business"),
  ],

  INFLUENCER: [
    f("personalInfo.firstName", "First name", 3, "Basics"),
    f("personalInfo.lastName", "Last name", 2, "Basics"),
    f("personalInfo.displayName", "Display name", 2, "Basics"),
    f("personalInfo.bio", "Bio", 3, "Basics"),
    f("personalInfo.location", "Location", 2, "Basics"),
    f("personalInfo.website", "Website", 1, "Basics"),
    f("personalInfo.phone", "Phone", 1, "Basics"),
    f("socialMedia.platforms.instagram.handle", "Instagram handle", 3, "Social"),
    f("socialMedia.platforms.instagram.followers", "Instagram followers", 3, "Social"),
    f("socialMedia.platforms.youtube.handle", "YouTube channel", 1, "Social"),
    f("contentInfo.primaryNiche", "Primary niche", 3, "Content"),
    f("contentInfo.contentCategories", "Content categories", 2, "Content"),
    f("contentInfo.contentTypes", "Content types", 1, "Content"),
    f("contentInfo.contentStyle", "Content style", 1, "Content"),
    f("contentCreation.languages", "Languages", 1, "Content"),
    f("business.rates", "Rates", 1, "Business"),
  ],

  DANCER: [
    f("firstName", "First name", 3, "Basics"),
    f("lastName", "Last name", 2, "Basics"),
    f("bio", "Bio", 3, "Basics"),
    f("location", "Location", 2, "Basics"),
    f("stageName", "Stage name", 1, "Basics"),
    f("website", "Website", 1, "Basics"),
    f("phone", "Phone", 1, "Basics"),
    f("primaryStyle", "Primary style", 3, "Craft"),
    f("danceStyles", "Dance styles", 2, "Craft"),
    f("experience", "Experience", 2, "Craft"),
    f("techniques", "Techniques", 2, "Craft"),
    f("specialSkills", "Special skills", 1, "Craft"),
    f("certifications", "Certifications", 1, "Craft"),
    f("languages", "Languages", 1, "Craft"),
    f("socialLinks.instagram", "Instagram link", 2, "Social"),
    f("rates", "Rates", 1, "Business"),
    f("services", "Services offered", 1, "Business"),
  ],

  MUSICIAN: [
    f("firstName", "First name", 3, "Basics"),
    f("lastName", "Last name", 2, "Basics"),
    f("bio", "Bio", 3, "Basics"),
    f("location", "Location", 2, "Basics"),
    f("stageName", "Stage name", 1, "Basics"),
    f("website", "Website", 1, "Basics"),
    f("phone", "Phone", 1, "Basics"),
    f("primaryGenre", "Primary genre", 3, "Craft"),
    f("genres", "Genres", 1, "Craft"),
    f("primaryInstrument", "Primary instrument", 3, "Craft"),
    f("instruments", "Instruments", 1, "Craft"),
    f("musicalRole", "Musical role", 1, "Craft"),
    f("experience", "Experience", 2, "Craft"),
    f("musicalSkills", "Musical skills", 2, "Craft"),
    f("certifications", "Certifications", 1, "Craft"),
    f("socialLinks.instagram", "Instagram link", 2, "Social"),
    f("streamingStats.spotify", "Spotify stats", 1, "Social"),
    f("rates", "Rates", 1, "Business"),
  ],

  FILMMAKER: [
    f("firstName", "First name", 3, "Basics"),
    f("lastName", "Last name", 2, "Basics"),
    f("bio", "Bio", 3, "Basics"),
    f("location", "Location", 2, "Basics"),
    f("stageName", "Stage name", 1, "Basics"),
    f("website", "Website", 1, "Basics"),
    f("phone", "Phone", 1, "Basics"),
    f("primaryRole", "Primary role", 3, "Craft"),
    f("experience", "Experience", 2, "Craft"),
    f("specializations", "Specializations", 2, "Craft"),
    f("genres", "Genres", 1, "Craft"),
    f("skills", "Skills", 1, "Craft"),
    f("portfolioItems", "Portfolio / filmography", 2, "Work"),
    f("reelUrl", "Demo reel", 2, "Work"),
    f("imdbProfile", "IMDb profile", 1, "Work"),
    f("socialLinks.linkedin", "LinkedIn", 1, "Social"),
    f("socialLinks.instagram", "Instagram", 1, "Social"),
    f("rates", "Rates", 1, "Business"),
  ],

  BUSINESS: [
    f("about", "About / description", 3, "Basics"),
    f("email", "Email", 2, "Basics"),
    f("phone", "Phone", 1, "Basics"),
    f("website", "Website", 1, "Basics"),
    f("businessType", "Business type", 2, "Details"),
    f("foundingDate", "Founding date", 1, "Details"),
    f("state", "State", 2, "Details"),
    f("city", "City", 1, "Details"),
    f("instagram", "Instagram", 1, "Social"),
    f("linkedin", "LinkedIn", 1, "Social"),
    f("facebook", "Facebook", 1, "Social"),
    f("twitter", "Twitter", 1, "Social"),
    f("gstNumber", "GST number", 1, "Legal"),
    f("panNumber", "PAN number", 1, "Legal"),
  ],
};

// Tier thresholds (by completion %). Pro is reachable at 85% — a thorough
// profile, not literally every field.
export const TIERS = [
  { name: "Rising", min: 0 },
  { name: "Elite", min: 50 },
  { name: "Pro", min: 85 },
];

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  if (typeof value === "number") return value !== 0;
  return value.toString().trim() !== "";
}

export function calculateProfileCompletion(creatorType, data) {
  const fields = PROFILE_FIELDS[creatorType];

  // Unknown / unconfigured type — return a safe, explicit empty result.
  if (!fields || fields.length === 0) {
    return {
      percentage: 0,
      tier: "Rising",
      category: "Rising", // backwards-compatible alias
      nextTier: "Elite",
      nextTierAt: TIERS[1].min,
      pointsToNextTier: TIERS[1].min,
      missing: [],
    };
  }

  let totalWeight = 0;
  let filledWeight = 0;
  const missing = [];

  for (const field of fields) {
    totalWeight += field.weight;
    if (isFilled(getNestedValue(data, field.path))) {
      filledWeight += field.weight;
    } else {
      missing.push({
        label: field.label,
        section: field.section,
        weight: field.weight,
      });
    }
  }

  const percentage = totalWeight
    ? Math.round((filledWeight / totalWeight) * 100)
    : 0;

  // Resolve current tier and the next tier to aim for.
  let tier = TIERS[0];
  let nextTier = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (percentage >= TIERS[i].min) {
      tier = TIERS[i];
      nextTier = TIERS[i + 1] || null;
    }
  }

  // Surface the most impactful missing fields first.
  missing.sort((a, b) => b.weight - a.weight);

  return {
    percentage,
    tier: tier.name,
    category: tier.name, // backwards-compatible alias for existing UI
    nextTier: nextTier ? nextTier.name : null,
    nextTierAt: nextTier ? nextTier.min : null,
    pointsToNextTier: nextTier ? Math.max(0, nextTier.min - percentage) : 0,
    missing: missing.slice(0, 6),
  };
}
