import { PrismaClient } from '@prisma/client'

// Singleton pattern: reuse existing instance on hot reload (dev) to avoid exhausting DB connections
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient }

const prisma = globalForPrisma.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}

export default prisma
