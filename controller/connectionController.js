import { io } from "../index.js";
import prisma from "../util/prisma.js";
import { createNotification } from "./notificationController.js";

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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create new connection
      const newRequest = await tx.connection.create({
        data: {
          senderId,
          receiverId,
          status: "PENDING",
        },
        include: {
          sender: { select: { id: true, username: true, image: true } },
          receiver: { select: { id: true, username: true, image: true } },
        },
      });

      // 2. Create notification
      await createNotification(tx, {
        type: "CONNECTION_REQUEST",
        senderId,
        receiverId,
        message: `${sender.username} sent you a connection request`,
      });

      // 3. Emit socket event using newRequest
      io.to(receiverId).emit("connection:pendingUpdated", {
        type: "NEW_REQUEST",
        request: newRequest,
      });

      return newRequest;
    });

    return res
      .status(201)
      .json({ message: "Connection request sent", request: result });
  } catch (error) {
    // Unique-constraint race: a duplicate request slipped past the pre-check.
    if (error?.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Connection request already exists" });
    }
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
          select: {
            id: true,
            username: true,
            image: true,
            creatorProfile: {
              select: {
                creatorType: true, 
              },
            },
            businessProfile: {
              select: {
                id: true, 
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            image: true,
            creatorProfile: {
              select: {
                creatorType: true, 
              },
            },
            businessProfile: {
              select: {
                id: true, 
              },
            },
          },
        },
      },
    });

    const processedRequests = requests.map((conn) => ({
      ...conn,
      sender: {
        ...conn.sender,
        type: conn.sender.businessProfile ? "BUSINESS" : "CREATOR",
        creatorType: conn.sender.creatorProfile?.creatorType,
      },
      receiver: {
        ...conn.receiver,
        type: conn.receiver.businessProfile ? "BUSINESS" : "CREATOR",
        creatorType: conn.receiver.creatorProfile?.creatorType,
      },
    }));

    return res
      .status(200)
      .json({
        message: "Fetched all connections",
        requests: processedRequests,
      });
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
      return res.status(200).json({ message: "Request already accepted" });
    }

    if (connection.status !== "PENDING") {
      return res.status(400).json({
        message: `Cannot accept the request with status ${connection.status}`,
      });
    }

    const receiver = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Conditional update: only one concurrent request can flip PENDING→ACCEPTED,
      // so the notification/emit fire exactly once (no double-click duplicates).
      const upd = await tx.connection.updateMany({
        where: { id: connectionId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (upd.count === 0) return null;

      await createNotification(tx, {
        type: "CONNECTION_ACCEPTED",
        senderId: userId,
        receiverId: connection.senderId,
        message: `${receiver.username} accepted your connection request`,
      });

      io.to(connection.senderId).emit("connection:pendingUpdated", {
        type: "REQUEST_ACCEPTED",
        connectionId,
      });

      return tx.connection.findUnique({ where: { id: connectionId } });
    });

    if (!result) {
      return res.status(200).json({ message: "Request already accepted" });
    }

    return res.status(200).json({
      message: "Request Accepted",
      updatedRequest: result,
    });
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
      return res.status(200).json({ message: "Request already rejected" });
    }

    if (connection.status !== "PENDING") {
      return res.status(400).json({
        message: `Cannot reject the request with status ${connection.status}`,
      });
    }

    const receiver = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.connection.updateMany({
        where: { id: connectionId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      if (upd.count === 0) return null;

      await createNotification(tx, {
        type: "CONNECTION_REJECTED",
        senderId: userId,
        receiverId: connection.senderId,
        message: `${receiver.username} rejected your connection request`,
      });

      io.to(connection.senderId).emit("connection:pendingUpdated", {
        type: "REQUEST_REJECTED",
        connectionId,
      });

      return tx.connection.findUnique({ where: { id: connectionId } });
    });

    if (!result) {
      return res.status(200).json({ message: "Request already rejected" });
    }

    return res
      .status(200)
      .json({ message: "Request rejected", updatedRequest: result });
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

    // 🔥 Emit socket event so both users can update state
    io.to(connection.senderId).emit("connection:pendingUpdated", {
      type: "CONNECTION_DELETED",
      connectionId,
    });
    io.to(connection.receiverId).emit("connection:pendingUpdated", {
      type: "CONNECTION_DELETED",
      connectionId,
    });

    return res
      .status(200)
      .json({ message: "Connection deleted", deletedConnection });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
