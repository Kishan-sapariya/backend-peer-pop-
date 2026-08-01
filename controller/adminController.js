import prisma from "../util/prisma.js";
import { sendWelcomeEmail } from "../util/sendEmail.js";

/**
 * Build a month-by-month timeline of signups from a list of records that each
 * have a `createdAt`. Returns the last `months` buckets (oldest -> newest),
 * each shaped { month: "Jan 2026", key: "2026-01", count }.
 *
 * Bucketing is done in JS (rather than SQL date_trunc) so it works identically
 * across SQLite/Postgres/MySQL without dialect-specific date functions.
 */
const buildTimeline = (records, months = 6) => {
  const now = new Date();
  const buckets = [];
  const indexByKey = {};

  // Seed an ordered bucket for each of the last `months` months (incl. current)
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    indexByKey[key] = buckets.length;
    buckets.push({
      key,
      month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      count: 0,
    });
  }

  for (const rec of records) {
    const d = new Date(rec.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in indexByKey) buckets[indexByKey[key]].count += 1;
  }

  return buckets;
};

// Convert a Prisma groupBy result ([{ field, _count }]) into a plain object map
const groupToMap = (rows, field) =>
  rows.reduce((acc, row) => {
    acc[row[field]] = row._count?._all ?? row._count ?? 0;
    return acc;
  }, {});

// The earliest date that falls within the requested `months` window
const windowStart = (months) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
};

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

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

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

// Aggregated stats for the waitlist dashboard
export const getWaitlistStats = async (req, res) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 24);

    const [total, byRoleRows, byStatusRows, timelineRecords] = await Promise.all([
      prisma.waitlist.count(),
      prisma.waitlist.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.waitlist.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.waitlist.findMany({
        where: { createdAt: { gte: windowStart(months) } },
        select: { createdAt: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        byRole: groupToMap(byRoleRows, "role"),
        byStatus: groupToMap(byStatusRows, "status"),
        timeline: buildTimeline(timelineRecords, months),
        months,
      },
    });
  } catch (error) {
    console.error("Error fetching waitlist stats:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Paginated list of registered users (UserProfile)
export const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [users, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          username: true,
          email: true,
          image: true,
          role: true,
          isAdmin: true,
          isFounder: true,
          emailVerified: true,
          createdAt: true,
          businessProfile: { select: { status: true, companyName: true } },
          creatorProfile: { select: { creatorType: true } },
        },
      }),
      prisma.userProfile.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Toggle the singleton founder flag on a user (admin only).
// Enforces exactly one founder: setting a new one clears any existing founder.
export const setFounder = async (req, res) => {
  try {
    const { id } = req.params;
    const { isFounder } = req.body;

    const target = await prisma.userProfile.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isFounder) {
      // Demote any current founder(s), then promote this user — atomically.
      await prisma.$transaction([
        prisma.userProfile.updateMany({
          where: { isFounder: true, NOT: { id } },
          data: { isFounder: false },
        }),
        prisma.userProfile.update({
          where: { id },
          data: { isFounder: true },
        }),
      ]);
    } else {
      await prisma.userProfile.update({
        where: { id },
        data: { isFounder: false },
      });
    }

    return res.status(200).json({
      success: true,
      message: isFounder
        ? "User is now the platform founder"
        : "Founder status removed",
    });
  } catch (error) {
    console.error("Error setting founder:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Admin action: (re)send the welcome email to an existing user — useful for
// users who signed up before the automated welcome email existed.
export const sendWelcomeMailToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.userProfile.findUnique({
      where: { id },
      select: { email: true, username: true },
    });
    if (!user) {
      return res.status(404).json({ message: "We couldn't find that user." });
    }

    const result = await sendWelcomeEmail(user.email, user.username);
    if (!result?.success) {
      return res.status(502).json({
        message: "Couldn't send the welcome email — please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Welcome email sent to ${user.email}`,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return res.status(500).json({
      message: "Something went wrong on our end — please try again.",
    });
  }
};

// Aggregated stats for the registered-users dashboard
export const getUserStats = async (req, res) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 24);

    const [
      total,
      byRoleRows,
      verifiedCount,
      businessByStatusRows,
      timelineRecords,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.userProfile.count({ where: { emailVerified: true } }),
      prisma.businessProfile.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.userProfile.findMany({
        where: { createdAt: { gte: windowStart(months) } },
        select: { createdAt: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        byRole: groupToMap(byRoleRows, "role"),
        verified: verifiedCount,
        unverified: total - verifiedCount,
        businessByStatus: groupToMap(businessByStatusRows, "status"),
        timeline: buildTimeline(timelineRecords, months),
        months,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
