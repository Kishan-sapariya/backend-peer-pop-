import { io } from "../index.js";
import prisma from "../util/prisma.js";

export const createNotification = async (
  tx,
  { type, senderId, receiverId, message }
) => {
  const notification = await tx.notification.create({
    data: {
      type,
      senderId,
      receiverId,
      message,
    },
  });
  const count = await tx.notification.count({
    where: { receiverId, isRead: false },
  });
  io.to(receiverId).emit("newNotification", {
    notification,
    unreadCount: count,
  });

  return notification;
};

export const getNotifications = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const notifications = await prisma.notification.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, username: true, image: true } },
      },
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteNotification = async (req, res) => {
  const { id: userId } = req.user;
  const { notificationId } = req.params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.receiverId !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const markAsRead = async (req, res) => {
  const { id: userId } = req.user;
  const { notificationId } = req.params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.receiverId !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return res.status(200).json(updatedNotification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};