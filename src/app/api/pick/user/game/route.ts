import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch user's pick for a specific game in a specific league
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
    const gameId = searchParams.get('gameId')
    const leagueId = searchParams.get('leagueId')

    if (!gameId || !leagueId) {
      return NextResponse.json(
        { error: "gameId and leagueId are required" },
        { status: 400 }
      )
    }

    const pick = await prisma.pick.findUnique({
      where: {
        userId_leagueId_gameId: {
          userId: user.id,
          leagueId,
          gameId
        }
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            number: true,
            position: true
          }
        },
        game: {
          select: {
            id: true,
            opponent: true,
            gameDate: true,
            status: true,
            homeScore: true,
            awayScore: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })

    return NextResponse.json({ pick }, { status: 200 })
  } catch (error) {
    console.error("Get user pick error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

