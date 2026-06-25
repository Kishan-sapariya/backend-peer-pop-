// One-off local seed: creates (or refreshes) the singleton FOUNDER account.
// Run from the backend folder AFTER `npx prisma db push`:
//   node scripts/seedFounder.js
//
// Safe to re-run — it upserts by email and re-applies the known password.
import prisma from "../util/prisma.js";
import bcrypt from "bcrypt";

const EMAIL = "Ashish@gazonindia.com";
const USERNAME = "Ashish Jain";
const PASSWORD = "founder123";

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // Enforce the singleton: demote any existing founder(s) first.
  await prisma.userProfile.updateMany({
    where: { isFounder: true },
    data: { isFounder: false },
  });

  const user = await prisma.userProfile.upsert({
    where: { email: EMAIL },
    update: {
      isFounder: true,
      emailVerified: true,
      password: hashedPassword,
    },
    create: {
      username: USERNAME,
      email: EMAIL,
      password: hashedPassword,
      role: "CREATOR", // role is irrelevant for a founder; isFounder drives everything
      emailVerified: true, // login requires this
      isFounder: true,
    },
  });

  // Founder profile with sample content so every tab has something to show.
  const profile = await prisma.founderProfile.upsert({
    where: { userProfileId: user.id },
    update: {},
    create: {
      userProfileId: user.id,
      headline: "Founder & CEO of Peer Pop",
      bio: "I started Peer Pop to give creators and brands one honest place to find each other.\n\nOur mission is to make collaboration simple, fair, and built on real data.",
      location: "Bengaluru, India",
      website: "https://peerpop.example",
      linkedinUrl: "https://linkedin.com/in/peerpop",
      twitterUrl: "https://twitter.com/peerpop",
      instagramUrl: "https://instagram.com/peerpop",
      milestones: [
        {
          title: "Founded Peer Pop",
          date: "2024-01-15",
          description: "Turned a late-night idea into a company.",
        },
        {
          title: "Crossed 1,000 waitlist signups",
          date: "2024-06-01",
          description: "First real signal of product–market fit.",
        },
      ],
    },
  });

  // Add one sample gallery image if none exist yet (any URL works for media).
  const withMedia = await prisma.founderProfile.findUnique({
    where: { id: profile.id },
    include: { media: true },
  });
  if (!withMedia.media.length) {
    await prisma.founderMedia.create({
      data: {
        founderProfileId: profile.id,
        type: "IMAGE",
        url: "https://picsum.photos/seed/peerpop/800/600",
        caption: "Team offsite",
      },
    });
  }

  console.log("\n✅ Founder seeded successfully:");
  console.log("   username :", USERNAME);
  console.log("   email    :", EMAIL);
  console.log("   password :", PASSWORD);
  console.log("   userId   :", user.id);
  console.log("   profile  : /profile/" + USERNAME + "/founder\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
