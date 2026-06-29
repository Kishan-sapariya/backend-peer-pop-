import { PrismaClient } from "@prisma/client";
import { calculateProfileCompletion } from "./profileConfig.js";

const globalForPrisma = globalThis;

const basePrisma =
  globalForPrisma.basePrisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

// Inject the completion tier/percentage into the profile's JSON `data` so it
// can be filtered on directly in search (no extra schema column / migration).
// Prisma replaces the whole JSON value on write, so `payload.data` is always
// the full object — recomputing from it is always correct.
function injectTier(payload, creatorType) {
  if (!payload || typeof payload !== "object") return;
  const json = payload.data;
  const type = creatorType || payload.creatorType;
  if (json && typeof json === "object" && !Array.isArray(json) && type) {
    const c = calculateProfileCompletion(type, json);
    payload.data = {
      ...json,
      completionTier: c.tier,
      completionPercentage: c.percentage,
    };
  }
}

export const prisma =
  globalForPrisma.prisma ||
  basePrisma.$extends({
    query: {
      creatorProfile: {
        async create({ args, query }) {
          injectTier(args.data);
          return query(args);
        },
        async upsert({ args, query }) {
          injectTier(args.create);
          // update side may omit creatorType (immutable) — reuse create's.
          injectTier(args.update, args.create?.creatorType);
          return query(args);
        },
        async update({ args, query }) {
          if (args.data?.data && !args.data.creatorType) {
            const existing = await basePrisma.creatorProfile.findUnique({
              where: args.where,
              select: { creatorType: true },
            });
            injectTier(args.data, existing?.creatorType);
          } else {
            injectTier(args.data);
          }
          return query(args);
        },
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.basePrisma = basePrisma;
  globalForPrisma.prisma = prisma;
}

export default prisma;
