import prisma from "./prisma.js";
export async function canViewProfile(requesterId, targetUser) {
  if (targetUser.visibility === "PUBLIC") return true;
  if (!requesterId) return false;
  if (requesterId === targetUser.id) return true;

  const connection = await prisma.connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: requesterId, receiverId: targetUser.id },
        { senderId: targetUser.id, receiverId: requesterId },
      ],
    },
  });

  return !!connection;
}
