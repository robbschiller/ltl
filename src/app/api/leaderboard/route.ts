import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch leaderboard data (all leagues or specific league)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (leagueId) {
      // Get leaderboard for specific league
      const league = await prisma.league.findUnique({
        where: { id: leagueId },
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
      })

      if (!league) {
        return NextResponse.json(
          { error: "League not found" },
          { status: 404 }
        )
      }

      // Check if user is member of league
      const membership = league.memberships.find(m => m.userId === user.id)
      if (!membership) {
        return NextResponse.json(
          { error: "You are not a member of this league" },
          { status: 403 }
        )
      }

      // Get picks for each member and calculate stats
      const leaderboardPromises = league.memberships.map(async (membership, index) => {
        // Fetch picks for this user in this league
        const picks = await prisma.pick.findMany({
          where: {
            userId: membership.userId,
            leagueId: leagueId
          },
          include: {
            game: {
              select: {
                status: true
              }
            }
          }
        })

        const finalPicks = picks.filter(p => p.game.status === 'final')
        const totalPicks = picks.length
        
        return {
          rank: index + 1,
          userId: membership.user.id,
          displayName: membership.user.name || membership.user.email,
          points: membership.totalPoints,
          totalPicks: totalPicks,
          completedPicks: finalPicks.length,
          isCurrentUser: membership.userId === user.id
        }
      })

      const leaderboard = await Promise.all(leaderboardPromises)

      return NextResponse.json({
        league: {
          id: league.id,
          name: league.name,
          seasonYear: league.seasonYear
        },
        leaderboard
      }, { status: 200 })
    } else {
      // Get overall leaderboard across all user's leagues
      const memberships = await prisma.leagueMembership.findMany({
        where: {
          userId: user.id
        },
        include: {
          league: {
            select: {
              id: true,
              name: true,
              seasonYear: true
            }
          }
        },
        orderBy: {
          totalPoints: 'desc'
        }
      })

      // Get all picks for this user across all leagues
      const allPicks = await prisma.pick.findMany({
        where: {
          userId: user.id
        },
        include: {
          game: {
            select: {
              status: true
            }
          }
        }
      })

      // Aggregate stats across all leagues
      const totalPoints = memberships.reduce((sum, m) => sum + m.totalPoints, 0)
      const totalPicks = allPicks.length
      const finalPicks = allPicks.filter(p => p.game.status === 'final').length

      // For overall leaderboard, we can show user's stats across all leagues
      // Or we could aggregate all users across all leagues (more complex)
      // For now, let's show user's overall stats
      const leaderboard = [{
        rank: 1,
        userId: user.id,
        displayName: user.name || user.email,
        points: totalPoints,
        totalPicks: totalPicks,
        completedPicks: finalPicks,
        isCurrentUser: true
      }]

      return NextResponse.json({
        league: null,
        leaderboard
      }, { status: 200 })
    }
  } catch (error) {
    console.error("Get leaderboard error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

