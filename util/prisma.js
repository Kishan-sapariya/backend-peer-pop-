import { PrismaClient } from "@prisma/client";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1s

async function createPrismaClient() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const client = new PrismaClient();
      await client.$connect();
      console.log("✅ Prisma connected");
      return client;
    } catch (err) {
      console.error(`❌ Prisma connection failed (attempt ${i + 1}):`, err.message);
      if (i < MAX_RETRIES - 1) {
        await new Promise((res) => setTimeout(res, RETRY_DELAY));
      } else {
        throw err;
      }
    }
  }
}

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = await createPrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = await createPrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
