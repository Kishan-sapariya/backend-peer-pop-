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
    const validatedJoinType = joinType
      ? validateJoinType(joinType)
      : "ANYONE_CAN_JOIN";

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
    const { name, image, joinType, description } = req.body;

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
    if (image != null) dataToUpdate.image = image;

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

export const fetchAllGroups = async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true } },
      },
    });

    return res.status(200).json({
      message: "Successfully fetched the groups",
      groups,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message });
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
