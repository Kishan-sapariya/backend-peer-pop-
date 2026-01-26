import { streamUpload, uploadOptions } from "../config/cloudinary.js";
import { io } from "../index.js";
import prisma from "../util/prisma.js";

// -------------------- CREATE CONVERSATION --------------------
export const createConversation = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId || receiverId === senderId) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    // ensure both users exist
    const users = await prisma.userProfile.findMany({
      where: { id: { in: [senderId, receiverId] } },
    });
    if (users.length !== 2) {
      return res.status(404).json({ message: "One or both users not found" });
    }

    // check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          some: { userId: senderId },
        },
        AND: {
          participants: {
            some: { userId: receiverId },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
      },
    });

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    // create conversation + participants
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: senderId }, { userId: receiverId }],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Conversation created",
      conversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- GET ONE CONVERSATION --------------------
export const getConversation = async (req, res) => {
  const { conversationId } = req.params;
  const { id: userId } = req.user;

  try {
    if (!conversationId) {
      return res.status(400).json({ message: "Conversation id not provided" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
        messages: {
          include: {
            sender: { select: { id: true, username: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    return res.status(200).json({
      message: "Conversation fetched",
      conversation,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- GET ALL CONVERSATIONS --------------------
export const getAllConversations = async (req, res) => {
  const { id: userId } = req.user;

  try {
    if (!userId) {
      return res.status(400).json({ message: "User id not found" });
    }

    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, username: true, image: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1, // last message
              include: {
                sender: { select: { id: true, username: true, image: true } },
              },
            },
          },
        },
      },
    });

    const result = await Promise.all(
      conversations.map(async (c) => {
        const lastReadAt = c.lastReadAt;

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: c.conversationId,
            createdAt: { gt: lastReadAt || new Date(0) },
            senderId: { not: userId },
          },
        });

        return {
          id: c.conversation.id,
          participants: c.conversation.participants,
          lastMessage: c.conversation.messages[0] || null,
          unreadCount,
        };
      })
    );

    return res.status(200).json({
      message: "Conversations fetched",
      conversations: result,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- SEND MESSAGE --------------------
export const sendMessages = async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content, attachmentUrl, attachmentType } = req.body;
  const { conversationId } = req.params;

  try {
    if (!conversationId) {
      return res.status(400).json({ message: "Conversation id not provided" });
    }

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "Sender or receiver missing" });
    }

    if (!content && !attachmentUrl) {
      return res.status(400).json({ message: "Message content required" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const newMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        attachmentUrl,
        attachmentType,
      },
      include: {
        sender: { select: { id: true, username: true, image: true } },
      },
    });

    // emit new message
    io.to(receiverId).emit("receiveMessage", newMessage);
    io.to(senderId).emit("receiveMessage", newMessage);

    // also update conversation lastMessage in real-time
    io.to(receiverId).emit("conversationUpdated", {
      conversationId,
      lastMessage: newMessage,
    });
    io.to(senderId).emit("conversationUpdated", {
      conversationId,
      lastMessage: newMessage,
    });

    return res.status(200).json({
      message: "Message sent",
      newMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- GET MESSAGES --------------------
export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { id: userId } = req.user;
  const { cursor, limit = 20 } = req.query;

  try {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this conversation" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, username: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      ...(cursor && { cursor: { id: cursor } }),
    });

    const orderedMessages = messages.reverse();

    // mark as read
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });

    return res.status(200).json({
      message: "Messages fetched",
      messages: orderedMessages,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// -------------------- GET PUBLIC USERS FOR NEW CHAT --------------------
export const getPublicUsersForChat = async (req, res) => {
  const { id: userId } = req.user;
  const { search = "", limit = 20, cursor } = req.query;

  try {
    // Get user IDs who already have conversations with the current user
    const existingConversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = existingConversations.map((c) => c.conversationId);

    const usersInConversations = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: { in: conversationIds },
        userId: { not: userId },
      },
      select: { userId: true },
    });

    const excludeUserIds = [
      userId,
      ...usersInConversations.map((u) => u.userId),
    ];

    // Fetch public users excluding current user and users with existing conversations
    const users = await prisma.userProfile.findMany({
      where: {
        visibility: "PUBLIC",
        id: { notIn: excludeUserIds },
        ...(search && {
          OR: [
            { username: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true,
        username: true,
        image: true,
        firstName: true,
        lastName: true,
        role: true,
        creatorProfile: {
          select: {
            creatorType: true,
          },
        },
        businessProfile: {
          select: {
            companyName: true,
            industry: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit) + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const hasMore = users.length > parseInt(limit);
    const resultUsers = hasMore ? users.slice(0, -1) : users;

    return res.status(200).json({
      message: "Public users fetched",
      users: resultUsers,
      nextCursor: hasMore ? resultUsers[resultUsers.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching public users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- UPLOAD ATTACHMENT --------------------
export const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ message: "File size must be under 50MB" });
    }

    const mimeType = req.file.mimetype;
    let options;

    if (mimeType.startsWith("image/")) {
      options = uploadOptions.image;
    } else if (mimeType.startsWith("video/")) {
      options = uploadOptions.video;
    } else {
      options = {
        resource_type: "raw",
        folder: "messages/documents",
        allowed_formats: [
          "pdf",
          "doc",
          "docx",
          "txt",
          "ppt",
          "pptx",
          "xls",
          "xlsx",
        ],
      };
    }

    const uploadedFile = await streamUpload(req.file.buffer, options);

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: uploadedFile.secure_url,
      fileType: mimeType,
    });
  } catch (error) {
    console.error("Error uploading attachment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
