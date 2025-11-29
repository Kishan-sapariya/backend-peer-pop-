import prisma from "../util/prisma.js";

export const getBusinessesForVerification = async (req, res) => {
  try {
    const businesses = await prisma.businessProfile.findMany({
      select: {
        id: true,
        userProfileId: true,
        companyName: true,
        about: true,
        businessType: true,
        foundedYear: true,
        gstNumber: true,
        panNumber: true,
        gstCertificateUrl: true,
        panDocumentUrl: true,
        status: true, 
        rejectionReason: true,
        lastReviewedAt: true,
        userProfile: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Fetched all businesses for verification",
      businesses,
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};


export const updateBusinessStatus = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }

    const business = await prisma.businessProfile.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        companyName: true,
        userProfileId: true,
        status: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    let updatedBusiness;
    let notificationType;
    let notificationMessage;

    if (action === "VERIFY") {
      updatedBusiness = await prisma.businessProfile.update({
        where: { id: businessId },
        data: {
          isVerified: true,
          status: "VERIFIED",
          rejectionReason: null,
          lastReviewedAt: new Date(),
        },
      });
      notificationType = "BUSINESS_VERIFICATION";
      notificationMessage = `🎉 Your business "${business.companyName}" has been verified successfully.`;
    } else if (action === "UNVERIFY") {
      updatedBusiness = await prisma.businessProfile.update({
        where: { id: businessId },
        data: {
          isVerified:false,
          status: "PENDING",
          rejectionReason: null,
          lastReviewedAt: new Date(),
        },
      });
      notificationType = "BUSINESS_UNVERIFICATION";
      notificationMessage = `⚠️ Your business "${business.companyName}" verification has been revoked by admin.`;
    } else if (action === "REJECT") {
      if (!rejectionReason) {
        return res
          .status(400)
          .json({ message: "Rejection reason is required" });
      }
      updatedBusiness = await prisma.businessProfile.update({
        where: { id: businessId },
        data: {
          isVerified:false,
          status: "REJECTED",
          rejectionReason,
          lastReviewedAt: new Date(),
        },
      });
      notificationType = "BUSINESS_REJECTION";
      notificationMessage = `❌ Your business account "${business.companyName}" was rejected for verification. Reason: ${rejectionReason}(reupload it from porfile-->3 dots-->reupload documents).`;
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await prisma.notification.create({
      data: {
        senderId: req.user.id, 
        receiverId: business.userProfileId, 
        type: notificationType,
        message: notificationMessage,
      },
    });

    return res.status(200).json({
      message: `Business ${action.toLowerCase()} successful`,
      business: updatedBusiness,
    });
  } catch (error) {
    console.error("Error updating business status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
