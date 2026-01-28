import cloudinary, {
  getCloudinaryPublicId,
  streamUpload,
  uploadOptions,
} from "../config/cloudinary.js";
import prisma from "../util/prisma.js";
import { calculateProfileCompletion } from "../util/profileConfig.js";
import { io } from "../index.js";

export const getUserDetailsForFeed = async (req, res) => {
  const { id: userId } = req.user;
  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        image: true,
        role: true,
        creatorProfile: {
          select: {
            creatorType: true,
            data: true,
          },
        },
        businessProfile: {
          select: {
            industry: true,
            businessType: true,
            headquarters: true,
          },
        },
        requestsSent: {
          select: { status: true },
        },
        requestsReceived: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const peersCount =
      user.requestsSent.filter((r) => r.status === "ACCEPTED").length +
      user.requestsReceived.filter((r) => r.status === "ACCEPTED").length;

    const postCount = await prisma.post.count({
      where: { userId },
    });

    let completion;
    if (user.role === "BUSINESS" && user.businessProfile) {
      const businessData = {
        businessInfo: {
          industry: user.businessProfile.industry,
          businessType: user.businessProfile.businessType,
        },
      };
      completion = {};
    } else if (user.creatorProfile) {
      completion = calculateProfileCompletion(
        user.creatorProfile.creatorType,
        user.creatorProfile.data
      );
    } else {
      completion = { percentage: 0, category: "Rising" };
    }

    let handleName = null;

    if (user.creatorProfile) {
      const { creatorType, data } = user.creatorProfile;

      if (creatorType === "YOUTUBER") {
        handleName = data?.channelInfo?.channelHandle || null;
      } else if (creatorType === "COMEDIAN") {
        handleName = data?.personalInfo?.stageName || null;
      } else if (creatorType === "INFLUENCER") {
        handleName = data?.personalInfo?.displayName || null;
      }
    }

    const userDetails = {
      id: user.id,
      username: user.username,
      image: user.image,
      creatorType: user.creatorProfile?.creatorType,
      role: user.role,
      state: user.creatorProfile?.data?.personalInfo?.state,
      city: user.creatorProfile?.data?.personalInfo?.city,
      customCity: user.creatorProfile?.data?.personalInfo?.customCity,
      peersCount,
      postCount,
      handleName,
    };

    const businessDetails = {
      industry: user.businessProfile?.industry,
      businessType: user.businessProfile?.businessType,
      location: user.businessProfile?.headquarters,
    };

    return res.status(200).json({
      message: "Fetched user details",
      userDetails,
      businessDetails,
      completion,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createPost = async (req, res) => {
  const { description, category, customLabel, hashtags } = req.body;
  const { id: userId } = req.user;

  try {
    let mediaUrls = [];

    if (req.files) {
      const files = [
        ...(req.files.image || []),
        ...(req.files.images || []),
        ...(req.files.video || []),
      ];

      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          let options = uploadOptions.image;

          if (file.mimetype.startsWith("video")) {
            options = uploadOptions.video;
          }

          const result = await streamUpload(file.buffer, options);
          return result.secure_url;
        });

        mediaUrls = await Promise.all(uploadPromises);
      }
    }

    let parsedHashtags = [];
    try {
      parsedHashtags = hashtags ? JSON.parse(hashtags) : [];
    } catch (e) {
      parsedHashtags = [];
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        description,
        category,
        customLabel: category === "GENERAL" ? customLabel : null,
        hashtags: parsedHashtags,
        mediaUrls,
        user: { connect: { id: userId } },
      },
      include: {
        user: {
          select: { id: true, username: true, image: true },
        },
      },
    });

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
};

export const getMyPosts = async (req, res) => {
  const { id: userId } = req.user;
  const { profileId } = req.params;
  const { cursor, limit = 10 } = req.query;

  try {
    if (!profileId) {
      return res.status(404).json({ message: "Profile id not provided" });
    }
    const posts = await prisma.post.findMany({
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { userId: profileId, groupId: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            visibility: true,
            creatorProfile: {
              select: {
                creatorType: true,
              },
            },
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        comments: {
          include: { user: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      likedByMe: post.likes.length > 0,
      user: {
        ...post.user,
        creatorType: post.user.creatorProfile?.creatorType,
        creatorProfile: undefined,
      },
    }));

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Get My Posts Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch user posts" });
  }
};

export const getFeedPosts = async (req, res) => {
  const { id: userId } = req.user;
  const { cursor, limit = 10 } = req.query;

  try {
    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { senderId: userId, status: "ACCEPTED" },
          { receiverId: userId, status: "ACCEPTED" },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const connectedUserIds = connections.map((c) =>
      c.senderId === userId ? c.receiverId : c.senderId
    );

    const posts = await prisma.post.findMany({
      take: parseInt(limit, 10),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      where: {
        groupId: null,
        OR: [
          { user: { visibility: "PUBLIC" } },
          { userId },
          {
            user: { visibility: "PRIVATE" },
            userId: { in: connectedUserIds },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            visibility: true,
            creatorProfile: {
              select: {
                creatorType: true,
              },
            },
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
      },
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      likedByMe: post.likes.length > 0,
      user: {
        ...post.user,
        creatorType: post.user.creatorProfile?.creatorType,
        creatorProfile: undefined,
      },
    }));

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Get Feed Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
};

export const deletePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this post" });
    }

    if (post.mediaUrls && post.mediaUrls.length > 0) {
      for (const url of post.mediaUrls) {
        const publicId = getCloudinaryPublicId(url);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error("Error deleting media:", err);
          }
        }
      }
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

export const getPostForMyPeers = async (req, res) => {
  const userId = req.user.id;
  const { cursor, limit = 10 } = req.query;

  try {
    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { senderId: userId, status: "ACCEPTED" },
          { receiverId: userId, status: "ACCEPTED" },
        ],
      },
    });

    const peerIds = connections.map((c) =>
      c.senderId === userId ? c.receiverId : c.senderId
    );

    if (peerIds.length === 0) {
      return res.json({ posts: [], nextCursor: null });
    }

    const posts = await prisma.post.findMany({
      where: { userId: { in: peerIds }, groupId: null },
      take: parseInt(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            visibility: true,
            creatorProfile: {
              select: {
                creatorType: true,
              },
            },
          },
        },
        likes: { where: { userId }, select: { id: true } },
        _count: { select: { likes: true, comments: true } },
        comments: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
      },
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      likedByMe: post.likes.length > 0,
    }));

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error("Error fetching peer posts:", error);
    res.status(500).json({ message: "Failed to fetch peer posts" });
  }
};

export const toggelLike = async (req, res) => {
  const { id: userId } = req.user;
  const { postId } = req.params;

  try {
    if (!postId)
      return res.status(404).json({ message: "Post id not provided" });

    const post = await prisma.post.findFirst({ where: { id: postId } });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = await prisma.like.findFirst({
      where: { postId: post.id, userId },
    });

    if (alreadyLiked) {
      await prisma.like.delete({
        where: { postId_userId: { postId: post.id, userId } },
      });

      const likesCount = await prisma.like.count({
        where: { postId: post.id },
      });

      return res.status(200).json({
        message: "Post unliked",
        likesCount,
        likedByMe: false,
      });
    } else {
      await prisma.like.create({
        data: { userId, postId: post.id },
      });

      const likesCount = await prisma.like.count({
        where: { postId: post.id },
      });

      // Create notification for post owner (not for own posts)
      if (post.userId !== userId) {
        const liker = await prisma.userProfile.findUnique({
          where: { id: userId },
          select: { id: true, username: true, image: true },
        });

        const notification = await prisma.notification.create({
          data: {
            type: "POST_LIKE",
            senderId: userId,
            receiverId: post.userId,
            message: `${liker.username} liked your post`,
          },
          include: {
            sender: { select: { id: true, username: true, image: true } },
          },
        });

        const unreadCount = await prisma.notification.count({
          where: { receiverId: post.userId, isRead: false },
        });

        io.to(post.userId).emit("newNotification", {
          notification,
          unreadCount,
        });
      }

      return res.status(201).json({
        message: "Post liked",
        likesCount,
        likedByMe: true,
      });
    }
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ message: "Failed to like posts" });
  }
};

export const addComment = async (req, res) => {
  const { id: userId } = req.user;
  const { postId } = req.params;
  const { comment } = req.body;

  try {
    if (!postId) {
      return res.status(400).json({ message: "Post id not provided" });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const newComment = await prisma.comment.create({
      data: {
        userId,
        postId,
        content: comment.trim(),
      },
      include: {
        user: { select: { id: true, username: true, image: true } },
      },
    });

    const commentsCount = await prisma.comment.count({ where: { postId } });

    // Create notification for post owner (not for own posts)
    if (post.userId !== userId) {
      const commenter = await prisma.userProfile.findUnique({
        where: { id: userId },
        select: { id: true, username: true, image: true },
      });

      const notification = await prisma.notification.create({
        data: {
          type: "POST_COMMENT",
          senderId: userId,
          receiverId: post.userId,
          message: `${commenter.username} commented on your post`,
        },
        include: {
          sender: { select: { id: true, username: true, image: true } },
        },
      });

      const unreadCount = await prisma.notification.count({
        where: { receiverId: post.userId, isRead: false },
      });

      io.to(post.userId).emit("newNotification", {
        notification,
        unreadCount,
      });
    }

    return res.status(201).json({
      message: "Comment added",
      comment: newComment,
      commentsCount,
    });
  } catch (error) {
    console.error("Error commenting post:", error);
    res.status(500).json({ message: "Failed to comment on post" });
  }
};

export const deleteComment = async (req, res) => {
  const { id: userId } = req.user;
  const { postId, commentId } = req.params;

  try {
    if (!postId || !commentId) {
      return res
        .status(400)
        .json({ message: "Post id or Comment id not provided" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.userId !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this comment" });
    }

    const deletedComment = await prisma.comment.delete({
      where: { id: commentId },
    });

    return res.status(200).json({ message: "Comment deleted", deletedComment });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

export const getSuggestedUsers = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const connections = await prisma.connection.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const connectedIds = new Set();
    connections.forEach((c) => {
      connectedIds.add(c.senderId);
      connectedIds.add(c.receiverId);
    });
    connectedIds.add(userId);

    const suggestedUsers = await prisma.userProfile.findMany({
      where: {
        id: { notIn: Array.from(connectedIds) },
      },
      take: 10,
      select: {
        id: true,
        username: true,
        image: true,
        creatorProfile: {
          select: {
            creatorType: true,
            data: true,
          },
        },
      },
    });

    const shuffled = suggestedUsers.sort(() => Math.random() - 0.5);

    const finalUsers = shuffled.slice(0, 3).map((user) => {
      let completion = { percentage: 0, category: "Rising" };

      if (user.creatorProfile) {
        const { creatorType, data } = user.creatorProfile;
        completion = calculateProfileCompletion(creatorType, data);
      }

      return {
        id: user.id,
        username: user.username,
        image: user.image,
        creatorType: user.creatorProfile?.creatorType || null,
        completion,
      };
    });

    res.status(200).json({ users: finalUsers });
  } catch (error) {
    console.error("Error fetching suggested users:", error);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { postId } = req.params;

    if (!userId) {
      return res
        .status(403)
        .json({ success: false, message: "Login required" });
    }
    if (!postId) {
      return res
        .status(404)
        .json({ success: false, message: "Post id is required" });
    }

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { senderId: userId, status: "ACCEPTED" },
          { receiverId: userId, status: "ACCEPTED" },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const connectedUserIds = connections.map((c) =>
      c.senderId === userId ? c.receiverId : c.senderId
    );

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        OR: [
          { user: { visibility: "PUBLIC" } },
          { userId },
          {
            user: { visibility: "PRIVATE" },
            userId: { in: connectedUserIds },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            visibility: true,
            creatorProfile: {
              select: {
                creatorType: true,
              },
            },
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, image: true } },
          },
        },
      },
    });

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found or access denied" });
    }

    const formattedPost = {
      ...post,
      likesCount: post._count.likes,
      likedByMe: post.likes.length > 0,
      user: {
        ...post.user,
        creatorType: post.user.creatorProfile?.creatorType,
        creatorProfile: undefined,
      },
    };

    res.status(200).json({
      success: true,
      post: formattedPost,
    });
  } catch (error) {
    console.error("Get Post By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch post" });
  }
};
