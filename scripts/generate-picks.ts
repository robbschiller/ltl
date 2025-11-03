import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

export async function generatePicks(gameOpponent?: string) {
  const leagueId = 'cmhjf0v6b0001rvqdtzizwoeb'

  try {
    // Get the league
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        memberships: {
          include: {
            user: true
          }
        }
      }
    })

    if (!league) {
      console.error(`League ${leagueId} not found`)
      return
    }

    console.log(`Found league: ${league.name} (${league.code})`)
    console.log(`Members: ${league.memberships.length}`)

    // Get the game - use opponent filter if provided, otherwise get next game
    let nextGame
    if (gameOpponent) {
      nextGame = await prisma.game.findFirst({
        where: {
          status: 'scheduled',
          opponent: gameOpponent
        },
        orderBy: {
          gameDate: 'asc'
        }
      })
    } else {
      nextGame = await prisma.game.findFirst({
        where: {
          status: 'scheduled'
        },
        orderBy: {
          gameDate: 'asc'
        }
      })
    }

    if (!nextGame) {
      console.error(`No upcoming game found${gameOpponent ? ` for opponent: ${gameOpponent}` : ''}`)
      return
    }

    console.log(`Using game: vs ${nextGame.opponent} on ${nextGame.gameDate.toISOString()}`)

    // Get some active players
    const players = await prisma.player.findMany({
      where: {
        isActive: true
      },
      take: 10
    })

    if (players.length === 0) {
      console.error('No active players found')
      return
    }

    console.log(`Found ${players.length} active players`)

    // Create picks for different members
    const members = league.memberships.slice(0, Math.min(league.memberships.length, 5))
    
    for (let i = 0; i < members.length; i++) {
      const member = members[i]
      const player = players[i % players.length]

      // Check if pick already exists
      const existingPick = await prisma.pick.findUnique({
        where: {
          userId_leagueId_gameId: {
            userId: member.userId,
            leagueId: leagueId,
            gameId: nextGame.id
          }
        }
      })

      if (existingPick) {
        console.log(`Pick already exists for ${member.user.name || member.user.email} - ${player.name}`)
        continue
      }

      // Create pick
      const pick = await prisma.pick.create({
        data: {
          userId: member.userId,
          leagueId: leagueId,
          gameId: nextGame.id,
          playerId: player.id,
          playerName: player.name,
          pointsEarned: 0
        }
      })

      console.log(`✅ Created pick for ${member.user.name || member.user.email}: ${player.name} #${player.number || 'N/A'} (${player.position})`)
    }

    console.log(`\n✨ Generated picks for ${members.length} members`)
    console.log(`Game: vs ${nextGame.opponent} on ${nextGame.gameDate.toISOString()}`)
  } catch (error) {
    console.error('Error generating picks:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  const opponent = process.argv[2] // Get opponent from command line args
  generatePicks(opponent)
}

