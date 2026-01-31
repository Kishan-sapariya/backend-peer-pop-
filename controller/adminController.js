import prisma from "../util/prisma.js";

// Get all waitlist entries
export const getWaitlist = async (req, res) => {
  try {
    const { status, role, search, page = 1, limit = 20 } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [waitlist, total] = await Promise.all([
      prisma.waitlist.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.waitlist.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      waitlist,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Update waitlist entry status
export const updateWaitlistStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "ID and status are required",
      });
    }

    const updated = await prisma.waitlist.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating waitlist status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Delete waitlist entry
export const deleteWaitlistEntry = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.waitlist.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Waitlist entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting waitlist entry:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

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
