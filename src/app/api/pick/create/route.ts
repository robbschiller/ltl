import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { leagueId, gameId, playerId, playerName } = await request.json()

    // Validate input
    if (!leagueId || !gameId || !playerId || !playerName) {
      return NextResponse.json(
        { error: "Missing required fields: leagueId, gameId, playerId, playerName" },
        { status: 400 }
      )
    }

    // Check if user is a member of the league
    const membership = await prisma.leagueMembership.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: user.id
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this league" },
        { status: 403 }
      )
    }

    // Fetch the game
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    })

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      )
    }

    // Check if game has started (picks lock 30 minutes before game)
    const gameStartTime = new Date(game.gameDate)
    const lockTime = new Date(gameStartTime.getTime() - 30 * 60 * 1000) // 30 minutes before
    const now = new Date()

    if (now >= lockTime || game.status !== 'scheduled') {
      return NextResponse.json(
        { error: "Picks are locked for this game. Picks lock 30 minutes before game start." },
        { status: 400 }
      )
    }

    // Check if user already made a pick for this game in this league
    const existingPick = await prisma.pick.findUnique({
      where: {
        userId_leagueId_gameId: {
          userId: user.id,
          leagueId,
          gameId
        }
      }
    })

    if (existingPick) {
      return NextResponse.json(
        { error: "You have already made a pick for this game in this league" },
        { status: 400 }
      )
    }

    // Verify player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId }
    })

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      )
    }

    // Create the pick
    const pick = await prisma.pick.create({
      data: {
        userId: user.id,
        leagueId,
        gameId,
        playerId,
        playerName,
        lockedAt: null // Will be set when game locks
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
            gameDate: true
          }
        }
      }
    })

    return NextResponse.json(
      { 
        message: "Pick created successfully",
        pick: {
          id: pick.id,
          playerId: pick.playerId,
          playerName: pick.playerName,
          player: pick.player,
          gameId: pick.gameId,
          game: pick.game,
          leagueId: pick.leagueId,
          pointsEarned: pick.pointsEarned,
          pickedAt: pick.pickedAt
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Create pick error:", error)
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "You have already made a pick for this game in this league" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

