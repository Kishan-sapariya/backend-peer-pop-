export const PROFILE_FIELDS = {
  YOUTUBER: {
    required: [
      "personalInfo.firstName",
      "personalInfo.lastName",
      "channelInfo.channelName",
      "channelInfo.channelHandle",
      "personalInfo.email",
      "personalInfo.location",
      "personalInfo.bio",
      "statistics.subscriberCount",
      "statistics.totalViews",
      "contentInfo.primaryNiche",
    ],
    optional: [
      "personalInfo.phone",
      "personalInfo.website",
      "statistics.videoCount",
      "statistics.avgViews",
      "statistics.watchTimeHours",
      "channelInfo.channelAge",
      "contentInfo.contentCategories",
      "contentInfo.uploadFrequency",
      "contentInfo.videoLength",
      "contentInfo.contentStyle",
      "socialMedia.links.instagram",
      "socialMedia.links.twitter",
      "socialMedia.links.linkedin",
      "socialMedia.stats.instagram",
      "socialMedia.stats.twitter",
    ],
  },

  COMEDIAN: {
    required: [
      "personalInfo.firstName",
      "personalInfo.lastName",
      "personalInfo.email",
      "personalInfo.location",
      "personalInfo.bio",
      "comedyCareer.yearsPerforming",
      "comedyCareer.comedyStyle",
    ],
    optional: [
      "personalInfo.stageName",
      "personalInfo.phone",
      "personalInfo.website",
      "personalInfo.profileImage",
      "personalInfo.coverImage",
      "comedyCareer.showsPerformed",
      "comedyCareer.avgAudienceSize",
      "comedyCareer.primaryVenues",
      "comedyCareer.performanceFrequency",
      "performanceStats.totalAudience",
      "performanceStats.specialsReleased",
      "performanceStats.awardsWon",
      "performanceStats.mediaAppearances",
      "socialMedia.links.instagram",
      "socialMedia.links.twitter",
      "socialMedia.links.youtube",
      "socialMedia.links.facebook",
      "socialMedia.stats.instagram",
      "socialMedia.stats.twitter",
      "socialMedia.stats.youtube",
      "business.availability",
      "business.rates",
      "performanceDetails.setLength",
      "performanceDetails.contentRating",
      "performanceDetails.languages",
      "performanceDetails.travelWillingness",
      "preferences",
    ],
  },

  INFLUENCER: {
    required: [
      "personalInfo.firstName",
      "personalInfo.lastName",
      "personalInfo.displayName",
      "personalInfo.email",
      "personalInfo.location",
      "personalInfo.bio",
      "socialMedia.platforms.instagram.handle",
      "socialMedia.platforms.instagram.followers",
      "contentInfo.primaryNiche",
    ],
    optional: [
      "personalInfo.phone",
      "personalInfo.website",
      "personalInfo.profileImage",
      "personalInfo.coverImage",
      "contentInfo.contentCategories",
      "contentInfo.contentTypes",
      "contentInfo.postingFrequency",
      "contentInfo.contentStyle",
      "socialMedia.platforms.instagram.engagement",
      "socialMedia.platforms.instagram.verified",
      "socialMedia.platforms.youtube.handle",
      "socialMedia.platforms.youtube.subscribers",
      "socialMedia.platforms.youtube.avgViews",
      "socialMedia.platforms.youtube.verified",
      "socialMedia.platforms.twitter.handle",
      "socialMedia.platforms.twitter.followers",
      "socialMedia.platforms.twitter.engagement",
      "socialMedia.platforms.twitter.verified",
      "audience.age",
      "audience.gender",
      "audience.topLocations",
      "audience.interests",
      "brand.partnerships",
      "brand.campaignsCompleted",
      "brand.avgCampaignRate",
      "brand.preferredBrands",
      "business.availability.sponsoredPosts",
      "business.availability.stories",
      "business.availability.reels",
      "business.availability.youtube",
      "business.availability.events",
      "business.availability.ambassadorships",
      "business.rates.instagramPost",
      "business.rates.instagramStory",
      "business.rates.youtubeIntegration",
      "business.rates.eventAppearance",
      "contentCreation.equipment",
      "contentCreation.editingSoftware",
      "contentCreation.languages",
      "preferences.publicStats",
      "preferences.showRates",
      "preferences.allowBrandOutreach",
      "preferences.showContact",
    ],
  },
};

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

export function calculateProfileCompletion(creatorType, data) {
  const config = PROFILE_FIELDS[creatorType];
  if (!config) return { percentage: 0, category: "Basic" };

  const { required, optional } = config;

  // Check required
  const requiredFilled = required.filter((field) => {
    const value = getNestedValue(data, field);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value || {}).length > 0;
    return value && value.toString().trim() !== "";
  }).length;

  const totalRequired = required.length;
  let score = (requiredFilled / totalRequired) * 70;

  // Check optional
  const optionalFilled = optional.filter((field) => {
    const value = getNestedValue(data, field);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value || {}).length > 0;
    return value && value.toString().trim() !== "";
  }).length;

  const totalOptional = optional.length;
  if (totalOptional > 0) {
    score += (optionalFilled / totalOptional) * 30;
  }

  const percentage = Math.round(score);

  let category = "Rising";
  if (percentage >= 60 && percentage < 100) category = "Elite";
  if (percentage === 100) category = "Pro";

  return { percentage, category };
}
