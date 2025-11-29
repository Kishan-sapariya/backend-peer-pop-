import {
  getCloudinaryPublicId,
  streamUpload,
  uploadOptions,
} from "../config/cloudinary.js";
import prisma from "../util/prisma.js";
import {
  validateGroupDesc,
  validateGroupName,
  validateJoinType,
} from "../validators/groupValidators.js";

export const createGroup = async (req, res) => {
  try {
    const { id: adminId } = req.user || {};
    const { name, description, joinType } = req.body;
    if (!adminId)
      return res.status(401).json({ message: "Authentication required" });

    const validatedName = validateGroupName(name);
    const validatedDescription = validateGroupDesc(description);
    const validatedJoinType = validateJoinType(joinType);

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          adminId,
          name: validatedName,
          description: validatedDescription,
          joinType: validatedJoinType,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: g.id,
          userId: adminId,
          role: "ADMIN",
        },
      });

      return g;
    });

    return res
      .status(201)
      .json({ message: "Group created successfully", group });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Group name already exists." });
    }
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { id: adminId } = req.user || {};
    const { groupId } = req.params;

    if (!adminId)
      return res.status(401).json({ message: "Authentication required" });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.adminId !== adminId) {
      return res
        .status(403)
        .json({ message: "Only group owner can delete this group" });
    }

    const deleted = await prisma.group.delete({
      where: { id: groupId },
    });

    return res.status(200).json({
      message: "Group deleted successfully",
      group: deleted,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { id: adminId } = req.user || {};
    const { groupId } = req.params;
    const { name, joinType, description } = req.body;

    if (!adminId)
      return res.status(401).json({ message: "Authentication required" });

    const existingGroup = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!existingGroup)
      return res.status(404).json({ message: "Group not found" });
    if (existingGroup.adminId !== adminId)
      return res
        .status(403)
        .json({ message: "Only group owner can update this group" });

    const dataToUpdate = {};

    if (name != null) dataToUpdate.name = validateGroupName(name);
    if (description != null)
      dataToUpdate.description = validateGroupDesc(description);
    if (joinType != null) dataToUpdate.joinType = validateJoinType(joinType);

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: dataToUpdate,
    });

    return res.status(200).json({
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Group name already exists." });
    }
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const uploadImage = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    const { groupId } = req.params;
    if (!adminId)
      return res.status(401).json({ message: "Authentication required" });
    if (!req.file)
      return res.status(404).json({ message: "Image is required" });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.adminId !== adminId)
      return res.status(403).json({ message: "Only admin can upload image" });

    if (group.image) {
      const publicId = getCloudinaryPublicId(group.image);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }
    }

    const uploadedImage = await streamUpload(req.file.buffer, {
      ...uploadOptions.image,
      folder: "group-profile-pictures",
    });
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { image: uploadedImage.secure_url },
    });

    return res.status(200).json({
      message: "Group image updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const fetchFourGroups = async (req, res) => {
  try {
    const userId = req.user.id; 

    const joined = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });

    const joinedIds = joined.map((j) => j.groupId);

    const allAvailableGroups = await prisma.group.findMany({
      where: {
        id: { notIn: joinedIds },
      },
      select: { id: true },
    });

    const shuffled = allAvailableGroups
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const groups = await prisma.group.findMany({
      where: {
        id: { in: shuffled.map((g) => g.id) },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return res.status(200).json({
      message: "Successfully fetched groups",
      groups,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    const { groupId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authentication required" });
    if (!groupId)
      return res.status(400).json({ message: "Group id not provided" });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.joinType === "INVITE_ONLY") {
      return res.status(403).json({ message: "This group is invite only" });
    }

    try {
      const membership = await prisma.groupMember.create({
        data: { groupId, userId },
      });

      return res.status(201).json({
        message: "Joined group successfully",
        membership,
      });
    } catch (err) {
      if (err.code === "P2002") {
        return res
          .status(409)
          .json({ message: "User is already a member of this group" });
      }
      throw err;
    }
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    const { groupId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authentication required" });
    if (!groupId)
      return res.status(400).json({ message: "Group id not provided" });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.adminId === userId)
      return res
        .status(403)
        .json({ message: "Group owner cannot leave the group" });

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!membership)
      return res
        .status(404)
        .json({ message: "You are not a member of this group" });

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    return res.status(200).json({ message: "Left group successfully" });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message });
  }
};

export const fetchJoinedGroup = async (req, res) => {
  try {
    const { id: userId } = req.user;
    if (!userId)
      return res.status(401).json({ message: "Authentication required" });

    const joinedGroups = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });
    const groups = joinedGroups.map((gm) => gm.group);
    return res
      .status(200)
      .json({ message: "Fetched joined groups successfully", groups });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const fetchGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { id: userId } = req.user;
    if (!userId)
      return res.status(401).json({ message: "Authentication required" });
    if (!groupId)
      return res.status(404).josn({ message: "Group id is required" });
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        joinType: true,
        _count: { select: { members: true } },
      },
    });
    return res
      .status(200)
      .json({ message: "Fetched group successfully", group });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { groupId } = req.params;

    if (!userId) {
      return res.status(403).json({ message: "Authentication required" });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });

    if (!isMember) {
      return res.status(401).json({
        message: "You must be a member of the group to post",
      });
    }

    const { description } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: "Description cannot be empty" });
    }

    const mediaUrls = [];
    const files = req.files || {};

    if (files.image) {
      for (const file of files.image) {
        const uploaded = await streamUpload(file.buffer, {
          folder: "group-posts/images",
        });
        mediaUrls.push(uploaded.secure_url);
      }
    }

    if (files.images) {
      for (const file of files.images) {
        const uploaded = await streamUpload(file.buffer, {
          folder: "group-posts/images",
        });
        mediaUrls.push(uploaded.secure_url);
      }
    }

    if (files.video) {
      for (const vid of files.video) {
        const uploaded = await streamUpload(vid.buffer, {
          resource_type: "video",
          folder: "group-posts/videos",
        });
        mediaUrls.push(uploaded.secure_url);
      }
    }

    const post = await prisma.post.create({
      data: {
        userId,
        groupId,
        description,
        mediaUrls,
      },
      select: {
        id: true,
        description: true,
        mediaUrls: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            image: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    console.error("Error creating group post:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchGroupPosts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { id: userId } = req.user; // needed for likedByMe

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const posts = await prisma.post.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        description: true,
        mediaUrls: true,
        hashtags: true,
        createdAt: true,

        user: {
          select: {
            id: true,
            username: true,
            image: true,
          },
        },

        // likes count
        likes: {
          select: {
            userId: true,
          },
        },

        // comments list
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // transform: add likesCount + likedByMe + commentsCount
    const formatted = posts.map((p) => ({
      ...p,
      likesCount: p.likes.length,
      likedByMe: p.likes.some((l) => l.userId === userId),
      commentsCount: p.comments.length,
    }));

    return res.status(200).json({
      message: "Group posts fetched successfully",
      posts: formatted,
    });
  } catch (err) {
    console.error("Error fetching group posts:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const likeGroupPost = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { groupId, postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { groupId: true },
    });

    if (!post || post.groupId !== groupId) {
      return res.status(404).json({ message: "Post not found in this group" });
    }

    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!isMember) {
      return res.status(403).json({ message: "You must be a member to like" });
    }

    const existingLike = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { postId_userId: { postId, userId } },
      });
    } else {
      await prisma.like.create({
        data: { postId, userId },
      });
    }

    const likesCount = await prisma.like.count({ where: { postId } });
    const likedByMe = !existingLike;

    return res.status(200).json({
      message: "Like toggled",
      likesCount,
      likedByMe,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const commentOnGroupPost = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { groupId, postId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validate post belongs to group
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { groupId: true },
    });

    if (!post || post.groupId !== groupId) {
      return res.status(404).json({ message: "Post not found in this group" });
    }

    // Membership check
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You must be a member to comment" });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        postId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Comment added",
      comment,
    });
  } catch (error) {
    console.error("Error commenting:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteGroupComment = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { groupId, postId, commentId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validate group + comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: true,
        user: true,
      },
    });

    if (!comment || comment.postId !== postId) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.post.groupId !== groupId) {
      return res.status(403).json({ message: "Not allowed for this group" });
    }

    // Check if current user is:
    // - comment owner OR
    // - group admin
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { adminId: true },
    });

    const isAdmin = group.adminId === userId;
    const isOwner = comment.userId === userId;

    if (!isAdmin && !isOwner) {
      return res
        .status(403)
        .json({ message: "Not allowed to delete this comment" });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteGroupPost = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { groupId, postId } = req.params;

    if (!userId) {
      return res.status(403).json({ message: "Authentication required" });
    }

    // 1️⃣ Validate group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { adminId: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Validate post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 3️⃣ Permission check → group admin OR post owner
    const isPostOwner = post.userId === userId;
    const isGroupAdmin = group.adminId === userId;

    if (!isPostOwner && !isGroupAdmin) {
      return res.status(403).json({
        message: "You are not allowed to delete this post",
      });
    }

    // 4️⃣ Delete
    await prisma.post.delete({
      where: { id: postId },
    });

    return res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting group post:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
