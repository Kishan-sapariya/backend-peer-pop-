import { streamUpload, uploadOptions } from "../config/cloudinary.js";
import { io } from "../index.js";
import prisma from "../util/prisma.js";

export const createConversation = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId || receiverId === senderId) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    const users = await prisma.userProfile.findMany({
      where: { id: { in: [senderId, receiverId] } },
    });
    if (users.length !== 2) {
      return res.status(404).json({ message: "One or both users not found" });
    }

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
      include: { participants: true },
    });

    if (existingConversation) {
      return res.json(existingConversation);
    }

    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: senderId }, { userId: receiverId }],
        },
      },
      include: { participants: true },
    });

    res.status(201).json(newConversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getConversation = async (req, res) => {
  const { conversationId } = req.params;
  const { id: userId } = req.user;
  try {
    if (!conversationId) {
      return res.status(404).json({ message: "Conversation id not found" });
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { image: true, username: true, id: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { image: true, username: true, id: true },
            },
          },
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
    return res
      .status(200)
      .json({ message: "Conversation fetched", conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllConversations = async (req, res) => {
  const { id: userId } = req.user;

  try {
    if (!userId) {
      return res.status(404).json({ message: "User id not found" });
    }

    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, image: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!conversations.length) {
      return res.status(404).json({ message: "No conversation found" });
    }

    return res.status(200).json({
      message: "Conversations fetched",
      conversations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const sendMessages = async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content, attachmentUrl, attachmentType } = req.body;
  const { conversationId } = req.params;

  try {
    if (!conversationId) {
      return res.status(400).json({ message: "Conversation id not provided" });
    }

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "Sender or receiver is missing" });
    }

    if (!content && !attachmentUrl) {
      return res
        .status(400)
        .json({ message: "Message content or attachment is required" });
    }

    if (attachmentUrl && !attachmentType) {
      return res
        .status(400)
        .json({ message: "Attachment should have a type as well" });
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
        sender: true,
      },
    });

    io.to(receiverId).emit("receiveMessage", newMessage); 
    io.to(senderId).emit("receiveMessage", newMessage);

    return res.status(200).json({ message: "Message sent", newMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

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
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { id: senderId } = req.user;
  const { cursor, limit = 20 } = req.query;

  try {
    const isParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: senderId,
      },
    });

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this conversation" });
    }

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID not provided" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
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

    res.status(200).json({
      message: "Messages fetched",
      messages: orderedMessages,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
