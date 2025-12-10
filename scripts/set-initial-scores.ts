import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function setInitialScores() {
  try {
    console.log('Setting initial scores before Calgary game...\n')
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Create a map of name to user
    const nameToUser = new Map<string, typeof users[0]>()
    users.forEach((user) => {
      nameToUser.set(user.name, user)
    })

    let updated = 0
    let created = 0

    for (const { name, points } of scores) {
      const user = nameToUser.get(name)
      
      if (!user) {
        console.warn(`⚠ User not found: ${name}`)
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
        console.log(`✓ Updated ${name}: ${points} points`)
        updated++
      } else {
        // Create new score
        await prisma.userScore.create({
          data: {
            userId: user.id,
            totalSeasonPoints: points,
          },
        })
        console.log(`✓ Created ${name}: ${points} points`)
        created++
      }
    }

    console.log(`\n✅ Complete! Updated ${updated} scores, created ${created} new scores.`)
    
    // Show summary
    console.log('\nCurrent scores:')
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
      console.log(`${index + 1}. ${score.user.name}: ${score.totalSeasonPoints} points`)
    })
  } catch (error) {
    console.error('Error setting scores:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setInitialScores()

