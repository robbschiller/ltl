import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function setInitialPickOrder() {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
      },
    })

    // Create a map of name to user ID
    const nameToId = new Map<string, string>()
    users.forEach((user) => {
      nameToId.set(user.name, user.id)
    })

    // Build the order array
    const userIds: string[] = []
    for (const name of initialOrder) {
      const userId = nameToId.get(name)
      if (userId) {
        userIds.push(userId)
        console.log(`✓ Added ${name} (${userId})`)
      } else {
        console.warn(`⚠ User not found: ${name}`)
      }
    }

    if (userIds.length === 0) {
      console.error('No users found to set pick order')
      return
    }

    // Check if pick order already exists
    const existing = await prisma.pickOrder.findFirst()

    if (existing) {
      await prisma.pickOrder.update({
        where: { id: existing.id },
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
      console.log('\n✓ Updated existing pick order')
    } else {
      await prisma.pickOrder.create({
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
      console.log('\n✓ Created new pick order')
    }

    console.log('\nPick order set:')
    initialOrder.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`)
    })
  } catch (error) {
    console.error('Error setting pick order:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setInitialPickOrder()

