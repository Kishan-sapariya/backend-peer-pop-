import prisma from "../util/prisma.js";

export const sendConnectionReq = async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  try {
    if (!receiverId) {
      return res.status(400).json({ message: "receiverId is required" });
    }

    if (receiverId === senderId) {
      return res.status(400).json({
        message: "You cannot send connection request to yourself",
      });
    }

    const [sender, receiver] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: senderId } }),
      prisma.userProfile.findUnique({ where: { id: receiverId } }),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingRequest = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        NOT: { status: "REJECTED" },
      },
    });

    if (existingRequest) {
      return res
        .status(409)
        .json({ message: "Connection request already exists" });
    }

    const newRequest = await prisma.connection.create({
      data: {
        senderId,
        receiverId,
        status: "PENDING",
      },
    });

    return res
      .status(201)
      .json({ message: "Connection request sent", request: newRequest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getConnections = async (req, res) => {
  const { id: userId } = req.user;

  try {
    if (!userId) {
      return res.status(404).json({ message: "User not found" });
    }

    const requests = await prisma.connection.findMany({
      where: {
        OR: [{ receiverId: userId }, { senderId: userId }],
      },
      select: {
        id: true,
        status: true,
        senderId: true,
        receiverId: true,
        sender: {
          select: { id: true, username: true, image: true },
        },
        receiver: {
          select: { id: true, username: true, image: true },
        },
      },
    });

    return res
      .status(200)
      .json({ message: "Fetched all connections", requests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptRequest = async (req, res) => {
  const { id: userId } = req.user;
  const { connectionId } = req.params;
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        status: true,
      },
    });
    if (!connection) {
      return res.status(404).json({ message: "No connection request found" });
    }
    if (connection.receiverId !== userId) {
      return res
        .status(403)
        .json({ message: "You cannot accept this request" });
    }
    if (connection.status === "ACCEPTED") {
      return res.status(200).json({ message: "request already accepted" });
    }
    if (connection.status !== "PENDING") {
      return res.status(404).json({
        message: `Connot accept the request with status ${connection.status}`,
      });
    }
    const updatedRequest = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "ACCEPTED" },
    });
    return res
      .status(200)
      .json({ message: "Request Accpected", updatedRequest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const rejectRequest = async (req, res) => {
  const { id: userId } = req.user;
  const { connectionId } = req.params;
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        receiverId: true,
        senderId: true,
        status: true,
      },
    });
    if (!connection) {
      return res.status(404).json({ message: "No connection request found" });
    }
    if (connection.receiverId !== userId) {
      return res
        .status(403)
        .json({ message: "You cannot reject this request" });
    }
    if (connection.status === "REJECTED") {
      return res.status(200).json({ message: "request already rejected" });
    }
    if (connection.status !== "PENDING") {
      return res.status(404).json({
        message: `Connot accept the request with status ${connection.status}`,
      });
    }
    const updatedRequest = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "REJECTED" },
    });
    return res
      .status(200)
      .json({ message: "Request rejected", updatedRequest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteConnection = async (req, res) => {
  const { id: userId } = req.user;
  const { connectionId } = req.params;
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) {
      return res.status(404).json({ message: "No connection request found" });
    }
    if (connection.senderId !== userId && connection.receiverId !== userId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to remove this connection" });
    }
    const deletedConnection = await prisma.connection.delete({
      where: { id: connectionId },
    });
    return res.status(200).json({ message: "Request rejected", deletedConnection });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
