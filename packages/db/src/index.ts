import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { DEFAULT_DATABASE_URL, resolveDatabaseUrl } from './database-url';

export { DEFAULT_DATABASE_URL, Prisma, PrismaClient, resolveDatabaseUrl };

export type CopilotPrismaClient = PrismaClient;

type PrismaGlobal = typeof globalThis & {
  __copilotPrismaClient?: PrismaClient;
};

function createAdapter(connectionString: string): PrismaPg {
  return new PrismaPg(connectionString);
}

export function createPrismaClient(options?: { connectionString?: string }): PrismaClient {
  const connectionString = resolveDatabaseUrl(options?.connectionString);
  return new PrismaClient({
    adapter: createAdapter(connectionString)
  });
}

export function getPrismaClient(options?: { connectionString?: string }): PrismaClient {
  const globalForPrisma = globalThis as PrismaGlobal;

  if (!globalForPrisma.__copilotPrismaClient) {
    globalForPrisma.__copilotPrismaClient = createPrismaClient(options);
  }

  return globalForPrisma.__copilotPrismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  const globalForPrisma = globalThis as PrismaGlobal;
  const client = globalForPrisma.__copilotPrismaClient;

  if (!client) {
    return;
  }

  await client.$disconnect();
  globalForPrisma.__copilotPrismaClient = undefined;
}
