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

  // Red Wings players to seed
  const redWingsPlayers = [
    { name: 'Dylan Larkin', number: 71, position: 'Forward' },
    { name: 'Patrick Kane', number: 88, position: 'Forward' },
    { name: 'Alex DeBrincat', number: 93, position: 'Forward' },
    { name: 'Lucas Raymond', number: 23, position: 'Forward' },
    { name: 'David Perron', number: 57, position: 'Forward' },
    { name: 'Andrew Copp', number: 18, position: 'Forward' },
    { name: 'J.T. Compher', number: 37, position: 'Forward' },
    { name: 'Robby Fabbri', number: 14, position: 'Forward' },
    { name: 'Michael Rasmussen', number: 27, position: 'Forward' },
    { name: 'Joe Veleno', number: 90, position: 'Forward' },
    { name: 'Christian Fischer', number: 36, position: 'Forward' },
    { name: 'Daniel Sprong', number: 17, position: 'Forward' },
    { name: 'Moritz Seider', number: 53, position: 'Defense' },
    { name: 'Ben Chiarot', number: 8, position: 'Defense' },
    { name: 'Jake Walman', number: 96, position: 'Defense' },
    { name: 'Jeff Petry', number: 26, position: 'Defense' },
    { name: 'Shayne Gostisbehere', number: 41, position: 'Defense' },
    { name: 'Justin Holl', number: 3, position: 'Defense' },
    { name: 'Olli Maatta', number: 2, position: 'Defense' },
    { name: 'Alex Lyon', number: 34, position: 'Goalie' },
    { name: 'James Reimer', number: 47, position: 'Goalie' },
  ]

  console.log('\n🏒 Seeding Red Wings players...')
  for (const player of redWingsPlayers) {
    await prisma.player.upsert({
      where: { 
        name_number: {
          name: player.name,
          number: player.number
        }
      },
      update: {},
      create: player,
    })
    console.log(`✅ Seeded player: ${player.number} - ${player.name} (${player.position})`)
  }

  // Find or create a league to add users to
  console.log('\n🏆 Seeding league memberships...')
  const existingLeagues = await prisma.league.findMany({
    take: 1,
    orderBy: {
      createdAt: 'desc'
    }
  })

  let targetLeague = existingLeagues[0]
  
  // If no leagues exist, create one using the first test user
  if (!targetLeague) {
    const firstUser = await prisma.user.findFirst({
      where: {
        email: users[0].email
      }
    })

    if (firstUser) {
      targetLeague = await prisma.league.create({
        data: {
          name: 'Test League',
          code: 'TEST123',
          createdById: firstUser.id,
          seasonYear: 2025,
        }
      })
      console.log(`✅ Created league: ${targetLeague.name} (${targetLeague.code})`)
    }
  } else {
    console.log(`✅ Using existing league: ${targetLeague.name} (${targetLeague.code})`)
  }

  // Add additional users for league membership
  const additionalUsers = [
    {
      email: 'alice@example.com',
      name: 'Alice Smith',
      password: hashedPassword,
    },
    {
      email: 'bob@example.com',
      name: 'Bob Johnson',
      password: hashedPassword,
    },
    {
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      password: hashedPassword,
    },
    {
      email: 'diana@example.com',
      name: 'Diana Williams',
      password: hashedPassword,
    },
    {
      email: 'eddie@example.com',
      name: 'Eddie Davis',
      password: hashedPassword,
    },
    {
      email: 'frank@example.com',
      name: 'Frank Miller',
      password: hashedPassword,
    },
  ]

  // Create additional users
  for (const user of additionalUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
      },
      create: user,
    })
    console.log(`✅ Seeded user: ${user.email} (${user.name})`)
  }

  // Add all users (including existing ones) to the league
  const allUserEmails = [...users.map(u => u.email), ...additionalUsers.map(u => u.email)]
  let membersAdded = 0
  
  if (targetLeague) {
    for (const email of allUserEmails) {
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (user) {
        await prisma.leagueMembership.upsert({
          where: {
            leagueId_userId: {
              leagueId: targetLeague.id,
              userId: user.id,
            }
          },
          update: {
            // Don't update anything if membership exists
          },
          create: {
            leagueId: targetLeague.id,
            userId: user.id,
            role: user.email === 'test@example.com' ? 'admin' : 'member',
            totalPoints: Math.floor(Math.random() * 200), // Random points for variety
          },
        })
        membersAdded++
        console.log(`✅ Added ${email} to league ${targetLeague.name}`)
      }
    }
  }

  // Create some upcoming games if they don't exist
  console.log('\n📅 Seeding upcoming games...')
  const now = new Date()
  const upcomingGames = [
    {
      opponent: 'Toronto Maple Leafs',
      gameDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      isHome: true,
      status: 'scheduled',
    },
    {
      opponent: 'Chicago Blackhawks',
      gameDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      isHome: false,
      status: 'scheduled',
    },
    {
      opponent: 'Tampa Bay Lightning',
      gameDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      isHome: true,
      status: 'scheduled',
    },
    {
      opponent: 'Boston Bruins',
      gameDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isHome: false,
      status: 'scheduled',
    },
    {
      opponent: 'Montreal Canadiens',
      gameDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      isHome: true,
      status: 'scheduled',
    },
  ]

  for (const gameData of upcomingGames) {
    const existingGame = await prisma.game.findFirst({
      where: {
        gameDate: gameData.gameDate,
        opponent: gameData.opponent,
      }
    })

    if (!existingGame) {
      await prisma.game.create({
        data: {
          ...gameData,
          homeTeam: 'Detroit Red Wings',
          awayTeam: gameData.isHome ? gameData.opponent : 'Detroit Red Wings',
        }
      })
      console.log(`✅ Seeded game: vs ${gameData.opponent} on ${gameData.gameDate.toLocaleDateString()}`)
    } else {
      console.log(`⏭️  Game already exists: vs ${gameData.opponent} on ${gameData.gameDate.toLocaleDateString()}`)
    }
  }

  console.log('\n✨ Seed completed successfully!')
  console.log(`📧 Test credentials: Any user with password "${password}"`)
  console.log(`🏆 League: ${targetLeague?.name || 'None'} (${targetLeague?.code || 'N/A'})`)
  console.log(`👥 Users added to league: ${membersAdded}`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

