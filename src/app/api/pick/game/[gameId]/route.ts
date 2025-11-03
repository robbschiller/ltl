import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch all picks for a specific game, optionally filtered by league
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { gameId } = await context.params
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    console.log(`[Pick API] Fetching picks for gameId: ${gameId}, leagueId: ${leagueId}, userId: ${user.id}`)

    // Build query
    const where: any = {
      gameId
    }

    // If leagueId is provided, filter by league
    if (leagueId) {
      // Verify user is member of the league
      const membership = await prisma.leagueMembership.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId: user.id
          }
        }
      })

      if (!membership) {
        console.log(`[Pick API] User ${user.id} is not a member of league ${leagueId}`)
        return NextResponse.json(
          { error: "You are not a member of this league" },
          { status: 403 }
        )
      }

      where.leagueId = leagueId
    }

    const picks = await prisma.pick.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            number: true,
            position: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        pickedAt: 'desc'
      }
    })

    console.log(`[Pick API] Found ${picks.length} picks for game ${gameId} in league ${leagueId}`)
    picks.forEach(p => console.log(`  - ${p.user.name || p.user.email}: ${p.playerName}`))

    return NextResponse.json({ picks }, { status: 200 })
  } catch (error) {
    console.error("Get picks for game error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

