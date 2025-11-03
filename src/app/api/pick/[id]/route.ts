import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch a pick by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    const pick = await prisma.pick.findUnique({
      where: { id },
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

    if (!pick) {
      return NextResponse.json(
        { error: "Pick not found" },
        { status: 404 }
      )
    }

    // Only allow users to see their own picks or picks in their leagues
    if (pick.userId !== user.id) {
      // Check if user is in the same league
      const membership = await prisma.leagueMembership.findUnique({
        where: {
          leagueId_userId: {
            leagueId: pick.leagueId,
            userId: user.id
          }
        }
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Unauthorized to view this pick" },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ pick }, { status: 200 })
  } catch (error) {
    console.error("Get pick error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE: Delete a pick (only if not locked)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    const pick = await prisma.pick.findUnique({
      where: { id },
      include: {
        game: true
      }
    })

    if (!pick) {
      return NextResponse.json(
        { error: "Pick not found" },
        { status: 404 }
      )
    }

    // Only allow users to delete their own picks
    if (pick.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this pick" },
        { status: 403 }
      )
    }

    // Check if pick is locked
    if (pick.lockedAt || pick.game.status !== 'scheduled') {
      return NextResponse.json(
        { error: "Cannot delete locked pick" },
        { status: 400 }
      )
    }

    // Check lock time (30 minutes before game)
    const gameStartTime = new Date(pick.game.gameDate)
    const lockTime = new Date(gameStartTime.getTime() - 30 * 60 * 1000)
    const now = new Date()

    if (now >= lockTime) {
      return NextResponse.json(
        { error: "Picks are locked for this game" },
        { status: 400 }
      )
    }

    await prisma.pick.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: "Pick deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete pick error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

