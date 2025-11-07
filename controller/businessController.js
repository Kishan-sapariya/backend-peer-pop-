import prisma from "../util/prisma.js";

import { streamUpload, uploadOptions } from "../config/cloudinary.js";

export const postBusinessDetails = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const { basicInfo, contact, location, socials, gstNumber, panNumber } =
      req.body;

    let parsedBasicInfo = {};
    let parsedContact = {};
    let parsedLocation = {};
    let parsedSocials = {};

    try {
      parsedBasicInfo = basicInfo ? JSON.parse(basicInfo) : {};
      parsedContact = contact ? JSON.parse(contact) : {};
      parsedLocation = location ? JSON.parse(location) : {};
      parsedSocials = socials ? JSON.parse(socials) : {};
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON payload" });
    }

    // ✅ Required fields check
    if (!parsedBasicInfo.about || !parsedBasicInfo.businessType) {
      return res.status(400).json({
        message: "About and Business Type are required",
      });
    }

    if (
      !parsedBasicInfo.foundedYear ||
      parsedBasicInfo.foundedYear.trim() === ""
    ) {
      return res.status(400).json({
        message: "Founded Year is required",
      });
    }

    if (!gstNumber || !panNumber) {
      return res.status(400).json({
        message: "GST Number and PAN Number are required",
      });
    }

    // ✅ Fetch existing profile to preserve file URLs
    const existingProfile = await prisma.businessProfile.findUnique({
      where: { userProfileId: loggedInUserId },
    });

    let gstCertificateUrl = existingProfile?.gstCertificateUrl || null;
    let panDocumentUrl = existingProfile?.panDocumentUrl || null;

    // ✅ Upload GST Certificate if new file provided
    if (req.files?.gstFile?.[0]) {
      const result = await streamUpload(
        req.files.gstFile[0].buffer,
        uploadOptions.document
      );
      gstCertificateUrl = result.secure_url;
    }

    // ✅ Upload PAN Document if new file provided
    if (req.files?.panFile?.[0]) {
      const result = await streamUpload(
        req.files.panFile[0].buffer,
        uploadOptions.document
      );
      panDocumentUrl = result.secure_url;
    }

    // ✅ Upsert business profile
    const profile = await prisma.businessProfile.upsert({
      where: { userProfileId: loggedInUserId },
      update: {
        about: parsedBasicInfo.about,
        businessType: parsedBasicInfo.businessType,
        foundedYear: parsedBasicInfo.foundedYear,

        website: parsedContact.website || null,
        phone: parsedContact.phone || null,
        supportEmail: parsedContact.supportEmail || null,

        headquarters: parsedLocation.headquarters || null,

        linkedinUrl: parsedSocials.linkedinUrl || null,
        linkedinFollowers: parsedSocials.linkedinFollowers
          ? parseInt(parsedSocials.linkedinFollowers, 10)
          : null,

        twitterUrl: parsedSocials.twitterUrl || null,
        twitterFollowers: parsedSocials.twitterFollowers
          ? parseInt(parsedSocials.twitterFollowers, 10)
          : null,

        instagramUrl: parsedSocials.instagramUrl || null,
        instagramFollowers: parsedSocials.instagramFollowers
          ? parseInt(parsedSocials.instagramFollowers, 10)
          : null,

        facebookUrl: parsedSocials.facebookUrl || null,
        facebookFollowers: parsedSocials.facebookFollowers
          ? parseInt(parsedSocials.facebookFollowers, 10)
          : null,

        gstNumber,
        panNumber,
        gstCertificateUrl,
        panDocumentUrl,
      },
      create: {
        userProfileId: loggedInUserId,

        about: parsedBasicInfo.about,
        businessType: parsedBasicInfo.businessType,
        foundedYear: parsedBasicInfo.foundedYear,

        website: parsedContact.website || null,
        phone: parsedContact.phone || null,
        supportEmail: parsedContact.supportEmail || null,

        headquarters: parsedLocation.headquarters || null,

        linkedinUrl: parsedSocials.linkedinUrl || null,
        linkedinFollowers: parsedSocials.linkedinFollowers
          ? parseInt(parsedSocials.linkedinFollowers, 10)
          : null,

        twitterUrl: parsedSocials.twitterUrl || null,
        twitterFollowers: parsedSocials.twitterFollowers
          ? parseInt(parsedSocials.twitterFollowers, 10)
          : null,

        instagramUrl: parsedSocials.instagramUrl || null,
        instagramFollowers: parsedSocials.instagramFollowers
          ? parseInt(parsedSocials.instagramFollowers, 10)
          : null,

        facebookUrl: parsedSocials.facebookUrl || null,
        facebookFollowers: parsedSocials.facebookFollowers
          ? parseInt(parsedSocials.facebookFollowers, 10)
          : null,

        gstNumber,
        panNumber,
        gstCertificateUrl,
        panDocumentUrl,
      },
    });

    // ✅ Create a notification for the user
    await prisma.notification.create({
      data: {
        receiverId: loggedInUserId,
        type: "CUSTOM",
        message:
          "Thank you for submitting your business details. Within 24 hours your business account will be verified by our team.",
      },
    });

    return res.status(200).json({
      message: "Business profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Error in postBusinessDetails:", error);
    return res.status(500).json({
      message: error.message || "Error updating business profile",
    });
  }
};

export const getBusinessProfileDetailsByUsername = async (req, res) => {
  const { username } = req.params;
  try {
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    const user = await prisma.userProfile.findFirst({
      where: { username: username },
      select: {
        username: true,
        image: true,
        coverImage: true,
        visibility: true,
        id: true,
        businessProfile: true,
      },
    });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateBusinessBasicInfo = async (req, res) => {
  try {
    const loggedInUserId = req.user.id; 
    const { about, website, supportEmail, phone } = req.body;

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: loggedInUserId },
      data: {
        about: about || undefined,
        website: website || undefined,
        supportEmail: supportEmail || undefined,
        phone: phone || undefined,
      },
      select: {
        id: true,
        about: true,
        website: true,
        supportEmail: true,
        phone: true,
      },
    });

    return res.status(200).json({
      message: "Business info updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating business info:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const updateSocials = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const {
      linkedinUrl,
      linkedinFollowers,
      twitterUrl,
      twitterFollowers,
      instagramUrl,
      instagramFollowers,
      facebookUrl,
      facebookFollowers,
    } = req.body;

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: loggedInUserId },
      data: {
        linkedinUrl: linkedinUrl || null,
        linkedinFollowers: linkedinFollowers
          ? parseInt(linkedinFollowers, 10)
          : null,
        twitterUrl: twitterUrl || null,
        twitterFollowers: twitterFollowers
          ? parseInt(twitterFollowers, 10)
          : null,
        instagramUrl: instagramUrl || null,
        instagramFollowers: instagramFollowers
          ? parseInt(instagramFollowers, 10)
          : null,
        facebookUrl: facebookUrl || null,
        facebookFollowers: facebookFollowers
          ? parseInt(facebookFollowers, 10)
          : null,
      },
    });

    return res.status(200).json({
      message: "Socials updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating socials:", error);
    return res.status(500).json({
      message: "Failed to update socials",
    });
  }
};

export const reuploadBusinessDocuments = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;

    const existingProfile = await prisma.businessProfile.findUnique({
      where: { userProfileId: loggedInUserId },
    });

    if (!existingProfile) {
      return res.status(404).json({ message: "Business profile not found" });
    }

    if (existingProfile.status !== "REJECTED") {
      return res.status(403).json({
        message:
          "You can only re-upload documents if your business was rejected.",
      });
    }

    let gstCertificateUrl = existingProfile.gstCertificateUrl;
    let panDocumentUrl = existingProfile.panDocumentUrl;

    if (req.files?.gstFile?.[0]) {
      const result = await streamUpload(
        req.files.gstFile[0].buffer,
        uploadOptions.document
      );
      gstCertificateUrl = result.secure_url;
    }

    if (req.files?.panFile?.[0]) {
      const result = await streamUpload(
        req.files.panFile[0].buffer,
        uploadOptions.document
      );
      panDocumentUrl = result.secure_url;
    }

    const { gstNumber, panNumber } = req.body;

    if (!gstNumber || !panNumber) {
      return res
        .status(400)
        .json({ message: "GST number and PAN number are required" });
    }

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: loggedInUserId },
      data: {
        gstCertificateUrl,
        panDocumentUrl,
        gstNumber,
        panNumber,
        status: "PENDING",
        rejectionReason: null, 
      },
    });

    await prisma.notification.create({
      data: {
        receiverId: loggedInUserId,
        type: "CUSTOM",
        message:
          "Your documents have been re-uploaded successfully. Our team will review them again.",
      },
    });

    return res.status(200).json({
      message: "Documents re-uploaded successfully, pending admin review",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error in reuploadBusinessDocuments:", error);
    return res.status(500).json({
      message: error.message || "Error re-uploading documents",
    });
  }
};

export const updateBusinessServices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({ message: "Services must be an array" });
    }

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: userId },
      data: { services },
    });

    return res.status(200).json({
      message: "Services updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating services:", error);
    return res.status(500).json({ message: "Failed to update services" });
  }
};

export const updateBusinessAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    const { achievements } = req.body;

    if (!Array.isArray(achievements)) {
      return res.status(400).json({ message: "Achievements must be an array" });
    }

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: userId },
      data: { achievements },
    });

    return res.status(200).json({
      message: "Achievements updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating achievements:", error);
    return res.status(500).json({ message: "Failed to update achievements" });
  }
};

export const deleteBusinessService = async (req, res) => {
  try {
    const userId = req.user.id;
    const { index } = req.params;

    const profile = await prisma.businessProfile.findUnique({
      where: { userProfileId: userId },
      select: { services: true },
    });

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const updatedServices = [...(profile.services || [])];
    updatedServices.splice(index, 1);

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: userId },
      data: { services: updatedServices },
    });

    res.json({ profile: updatedProfile });
  } catch (err) {
    console.error("Error deleting service:", err);
    res.status(500).json({ message: "Failed to delete service" });
  }
};

export const deleteBusinessAchievement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { index } = req.params;

    const profile = await prisma.businessProfile.findUnique({
      where: { userProfileId: userId },
      select: { achievements: true },
    });

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const updatedAchievements = [...(profile.achievements || [])];
    updatedAchievements.splice(index, 1);

    const updatedProfile = await prisma.businessProfile.update({
      where: { userProfileId: userId },
      data: { achievements: updatedAchievements },
    });

    res.json({ profile: updatedProfile });
  } catch (err) {
    console.error("Error deleting achievement:", err);
    res.status(500).json({ message: "Failed to delete achievement" });
  }
};

