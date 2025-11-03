import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch dashboard data (primary league, members, next game)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Get user's primary league (most recently joined)
    const memberships = await prisma.leagueMembership.findMany({
      where: {
        userId: user.id
      },
      include: {
        league: {
          include: {
            memberships: {
              orderBy: {
                totalPoints: 'desc'
              },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      },
      take: 1
    })

    // If user has no leagues, return empty data
    if (memberships.length === 0) {
      return NextResponse.json({
        league: null,
        members: [],
        nextGame: null
      }, { status: 200 })
    }

    const membership = memberships[0]
    const league = membership.league

    // Get the next upcoming game (scheduled or in_progress)
    // Get the first scheduled game ordered by date, then by most recently updated
    // This ensures we get the game that was synced from NHL API (most recent)
    const now = new Date()
    
    // Get all scheduled games and find the next one
    // Order by date first, then by updatedAt desc to get most recently synced
    const nextGame = await prisma.game.findFirst({
      where: {
        status: {
          in: ['scheduled', 'in_progress']
        }
      },
      orderBy: [
        {
          gameDate: 'asc'
        },
        {
          updatedAt: 'desc' // Most recently updated (from NHL sync) takes priority
        }
      ]
    })

    // Log for debugging
    console.log('Dashboard API - Looking for next game. Now:', now.toISOString())
    
    // Check all scheduled games on the same date as the next game (to catch duplicates)
    if (nextGame) {
      const nextGameDate = new Date(nextGame.gameDate)
      nextGameDate.setHours(0, 0, 0, 0)
      const nextGameDateEnd = new Date(nextGameDate)
      nextGameDateEnd.setHours(23, 59, 59, 999)
      
      const gamesOnSameDate = await prisma.game.findMany({
        where: {
          gameDate: {
            gte: nextGameDate,
            lte: nextGameDateEnd
          },
          status: {
            in: ['scheduled', 'in_progress']
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      })
      
      if (gamesOnSameDate.length > 1) {
        console.log(`⚠️  Found ${gamesOnSameDate.length} games on ${nextGameDate.toISOString()}:`, 
          gamesOnSameDate.map(g => ({
            id: g.id,
            opponent: g.opponent,
            updatedAt: g.updatedAt.toISOString()
          }))
        )
        // Use the most recently updated one (from NHL sync)
        const mostRecent = gamesOnSameDate[0]
        if (mostRecent.id !== nextGame.id) {
          console.log(`🔄 Using most recently synced game: vs ${mostRecent.opponent} (updated: ${mostRecent.updatedAt.toISOString()})`)
          // Use the most recently updated game instead
          const updatedGame = await prisma.game.findUnique({
            where: { id: mostRecent.id }
          })
          if (updatedGame) {
            // Replace nextGame with the most recently updated one
            Object.assign(nextGame, updatedGame)
          }
        }
      }
    }
    
    if (!nextGame) {
      console.log('No next game found. Checking all scheduled games...')
      const allScheduled = await prisma.game.findMany({
        where: {
          status: 'scheduled'
        },
        orderBy: {
          gameDate: 'asc'
        },
        take: 5
      })
      console.log('Scheduled games found:', allScheduled.map(g => ({
        id: g.id,
        opponent: g.opponent,
        date: g.gameDate.toISOString(),
        status: g.status,
        updatedAt: g.updatedAt.toISOString(),
        dateIsFuture: g.gameDate > now
      })))
    } else {
      console.log('Next game found:', {
        id: nextGame.id,
        opponent: nextGame.opponent,
        date: nextGame.gameDate.toISOString(),
        status: nextGame.status,
        updatedAt: nextGame.updatedAt.toISOString(),
        dateIsFuture: nextGame.gameDate > now
      })
    }

    // Get picks for the next game if it exists
    let memberPicks = new Map<string, { playerId: string; playerName: string; playerNumber: number | null }>()
    
    if (nextGame) {
      const picks = await prisma.pick.findMany({
        where: {
          leagueId: league.id,
          gameId: nextGame.id
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              number: true
            }
          }
        }
      })

      for (const pick of picks) {
        memberPicks.set(pick.userId, {
          playerId: pick.playerId,
          playerName: pick.playerName,
          playerNumber: pick.player?.number || null
        })
      }
    }

    // Build members list with pick status
    const members = league.memberships.map((member, index) => {
      const userPick = memberPicks.get(member.userId)
      const hasPicked = !!userPick

      return {
        userId: member.user.id,
        displayName: member.user.name || member.user.email,
        hasPicked,
        pick: userPick || undefined,
        rank: index + 1,
        totalPoints: member.totalPoints
      }
    })

    // Calculate if next game is locked (30 minutes before game start)
    let isLocked = false
    let lockTime: string | null = null
    
    if (nextGame) {
      const gameStartTime = new Date(nextGame.gameDate)
      const lockDateTime = new Date(gameStartTime.getTime() - 30 * 60 * 1000) // 30 minutes before
      lockTime = lockDateTime.toISOString()
      isLocked = now >= lockDateTime
    }

    // Get user's pick for next game if it exists
    let userPick = undefined
    if (nextGame) {
      const pick = await prisma.pick.findUnique({
        where: {
          userId_leagueId_gameId: {
            userId: user.id,
            leagueId: league.id,
            gameId: nextGame.id
          }
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              number: true
            }
          }
        }
      })

      if (pick) {
        userPick = {
          playerId: pick.playerId,
          playerName: pick.playerName,
          playerNumber: pick.player?.number || null
        }
      }
    }

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        code: league.code,
        seasonYear: league.seasonYear
      },
      members,
      nextGame: nextGame ? {
        id: nextGame.id,
        opponent: nextGame.opponent,
        gameDate: nextGame.gameDate.toISOString(),
        isHome: nextGame.isHome,
        status: nextGame.status,
        isLocked,
        lockTime,
        userPick
      } : null
    }, { status: 200 })
  } catch (error) {
    console.error("Get dashboard error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

