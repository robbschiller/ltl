import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Hash password once (all users will use the same password for dev)
  const password = 'password123'
  const hashedPassword = await bcrypt.hash(password, 12)

  // Test users to seed
  const users = [
    {
      email: 'test@example.com',
      name: 'Test User',
      password: hashedPassword,
    },
    {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
    },
    {
      email: 'user@example.com',
      name: null, // Test optional name field
      password: hashedPassword,
    },
    {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  ]

  // Use upsert to avoid duplicate key errors (idempotent)
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
      },
      create: user,
    })
    console.log(`✅ Seeded user: ${user.email} (${user.name || 'no name'})`)
  }

  console.log('✨ Seed completed successfully!')
  console.log(`📧 Test credentials: Any user with password "${password}"`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

