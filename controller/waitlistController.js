import prisma from "../util/prisma.js";
import { sendWaitlistConfirmationEmail } from "../util/sendEmail.js";

export const addToWaitlist = async (req, res) => {
  try {
    let { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields" });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    role = role.toLowerCase() === "creator" ? "CREATOR" : "COMPANY";

    const existing = await prisma.waitlist.findUnique({
      where: { email },
    });

    if (existing) {
      // 409 Conflict = already exists
      return res.status(409).json({
        ok: false,
        existed: true,
        message: "You’ve already joined the waitlist.",
        data: existing,
      });
    }

    const entry = await prisma.waitlist.create({
      data: {
        name,
        email,
        role,
        status: "PENDING",
      },
    });

    // Fire email in background
    sendWaitlistConfirmationEmail(email, name, role).catch(console.error);

    return res.status(201).json({
      ok: true,
      existed: false,
      message: "Successfully added to waitlist.",
      data: entry,
    });
  } catch (err) {
    if (err.code === "P2002") {
      // Unique constraint violation
      return res.status(409).json({
        ok: false,
        existed: true,
        message: "You’ve already joined the waitlist.",
      });
    }

    console.error("Waitlist Create Error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
