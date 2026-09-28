import { PrismaClient } from "@prisma/client";

import { isWrite, scheduleBackup } from "@/lib/auto-backup";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  // Any change to the data - an item, a bill, a payment, stock - schedules an
  // automatic backup. Registered here, once, so every save in the app is
  // covered without each feature having to remember it.
  client.$use(async (params, next) => {
    const result = await next(params);
    if (isWrite(params.action)) scheduleBackup(client);
    return result;
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
