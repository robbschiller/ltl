import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const users = [
  { name: 'Timothy Schiller', email: 'timothy@example.com' },
  { name: 'Rob Schiller', email: 'rob@example.com' },
  { name: 'Robb Schiller', email: 'robb@example.com' },
  { name: 'Jordan Schiller', email: 'jordan@example.com' },
  { name: 'Andrew Karp', email: 'andrew@example.com' },
  { name: 'Jason Ballein', email: 'jason@example.com' },
  { name: 'Pedro Carmo', email: 'pedro@example.com' },
  { name: 'Wilma Harris', email: 'wilma@example.com' },
]

// Initial order for Calgary game
const initialOrder = [
  'Jason Ballein',
  'Jordan Schiller',
  'Andrew Karp',
  'Wilma Harris', // Will
  'Pedro Carmo',
  'Timothy Schiller', // Tim
  'Rob Schiller',
  'Robb Schiller',
]

// Scores before Calgary game
const scores = [
  { name: 'Timothy Schiller', points: 63 },
  { name: 'Jordan Schiller', points: 47 },
  { name: 'Wilma Harris', points: 41 }, // Will
  { name: 'Andrew Karp', points: 46 },
  { name: 'Pedro Carmo', points: 36 },
  { name: 'Rob Schiller', points: 42 },
  { name: 'Robb Schiller', points: 37 },
  { name: 'Jason Ballein', points: 30 },
]

async function main() {
  console.log('🌱 Starting database seed...\n')

  // Step 1: Create users
  console.log('📝 Step 1: Creating users...\n')
  
  const credentials: Array<{ name: string; email: string; password: string }> = []
  const createdUsers: Array<{ id: string; name: string }> = []

  for (const userData of users) {
    // Generate a simple password based on the name
    const firstName = userData.name.split(' ')[0].toLowerCase()
    const password = `${firstName}123`
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    })

    if (existing) {
      console.log(`  ⏭️  User ${userData.name} already exists, skipping...`)
      credentials.push({
        name: userData.name,
        email: userData.email,
        password: password,
      })
      createdUsers.push({ id: existing.id, name: existing.name })
      continue
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user with UserScore
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        score: {
          create: {
            totalSeasonPoints: 0,
          },
        },
      },
    })

    console.log(`  ✓ Created user: ${userData.name}`)
    credentials.push({
      name: userData.name,
      email: userData.email,
      password: password,
    })
    createdUsers.push({ id: user.id, name: user.name })
  }

  // Step 2: Set pick order
  console.log('\n📋 Step 2: Setting pick order...\n')
  
  // Create a map of name to user ID
  const nameToId = new Map<string, string>()
  createdUsers.forEach((user) => {
    nameToId.set(user.name, user.id)
  })

  // Build the order array
  const userIds: string[] = []
  for (const name of initialOrder) {
    const userId = nameToId.get(name)
    if (userId) {
      userIds.push(userId)
      console.log(`  ✓ Added ${name} to pick order`)
    } else {
      console.warn(`  ⚠️  User not found: ${name}`)
    }
  }

  if (userIds.length > 0) {
    // Check if pick order already exists
    const existing = await prisma.pickOrder.findFirst()

    if (existing) {
      await prisma.pickOrder.update({
        where: { id: existing.id },
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
      console.log('  ✓ Updated existing pick order')
    } else {
      await prisma.pickOrder.create({
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
      console.log('  ✓ Created new pick order')
    }
  }

  // Step 3: Set initial scores
  console.log('\n🏆 Step 3: Setting initial scores...\n')
  
  // Get all users (refresh to ensure we have all)
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
    },
  })

  // Create a map of name to user
  const nameToUser = new Map<string, typeof allUsers[0]>()
  allUsers.forEach((user) => {
    nameToUser.set(user.name, user)
  })

  let updated = 0
  let created = 0

  for (const { name, points } of scores) {
    const user = nameToUser.get(name)
    
    if (!user) {
      console.warn(`  ⚠️  User not found: ${name}`)
      continue
    }

    // Check if UserScore exists
    const existingScore = await prisma.userScore.findUnique({
      where: { userId: user.id },
    })

    if (existingScore) {
      // Update existing score
      await prisma.userScore.update({
        where: { userId: user.id },
        data: {
          totalSeasonPoints: points,
        },
      })
      console.log(`  ✓ Updated ${name}: ${points} points`)
      updated++
    } else {
      // Create new score
      await prisma.userScore.create({
        data: {
          userId: user.id,
          totalSeasonPoints: points,
        },
      })
      console.log(`  ✓ Created ${name}: ${points} points`)
      created++
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('✅ SEED COMPLETE')
  console.log('='.repeat(60))
  
  console.log('\n📊 Summary:')
  console.log(`  • Users: ${createdUsers.length}`)
  console.log(`  • Pick Order: ${userIds.length} users`)
  console.log(`  • Scores: ${updated} updated, ${created} created`)

  console.log('\n🔑 User Credentials:')
  console.log('='.repeat(60))
  credentials.forEach((cred, index) => {
    console.log(`${index + 1}. ${cred.name}`)
    console.log(`   Email: ${cred.email}`)
    console.log(`   Password: ${cred.password}`)
    console.log('')
  })

  console.log('\n📋 Pick Order:')
  console.log('='.repeat(60))
  initialOrder.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`)
  })

  console.log('\n🏆 Current Scores:')
  console.log('='.repeat(60))
  const allScores = await prisma.userScore.findMany({
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      totalSeasonPoints: 'desc',
    },
  })
  
  allScores.forEach((score, index) => {
    console.log(`  ${index + 1}. ${score.user.name}: ${score.totalSeasonPoints} points`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

