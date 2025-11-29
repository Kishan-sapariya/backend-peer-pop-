export const normalizeName = (s) => s.replace(/\s+/g, " ").trim();

export const validateGroupName = (name) => {
  if (typeof name !== "string")
    throw Object.assign(new Error("Group name must be a string"), {
      status: 400,
    });
  const n = normalizeName(name);
  if (n.length < 3)
    throw Object.assign(
      new Error("Group name must be at least 3 characters long"),
      { status: 400 }
    );
  return n;
};

export const validateGroupDesc = (description) => {
  if (description == null) return null; 
  if (description.length > 500)
    throw Object.assign(new Error("Description too long (max 500 chars)."), {
      status: 400,
    });
  return description;
};

export const validateJoinType = (jt) => {
  const allowed = ["INVITE_ONLY", "ANYONE_CAN_JOIN"];
  if (!allowed.includes(jt))
    throw Object.assign(new Error("Invalid joinType value."), { status: 400 });
  return jt;
};
