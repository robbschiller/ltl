import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL environment variable is required')
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

