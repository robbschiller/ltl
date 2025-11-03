import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchGameFeed, fetchGameBoxscore, isOvertimeGame, isShorthandedGoal, isEmptyNetGoal } from "@/lib/nhl-api"
import { calculatePlayerTotalPoints, type GoalEvent, type AssistEvent, type GoaliePerformance } from "@/lib/scoring"

// This endpoint calculates and updates points for all picks in a completed game
// Can be called manually or via a scheduled job
export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      )
    }

    // Fetch the game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        picks: {
          include: {
            player: true
          }
        }
      }
    })

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      )
    }

    // Only calculate points for final games
    if (game.status !== 'final') {
      return NextResponse.json(
        { error: "Game is not final yet. Cannot calculate points." },
        { status: 400 }
      )
    }

    // Check if points have already been calculated
    const hasPoints = game.picks.some(pick => pick.pointsEarned > 0)
    if (hasPoints) {
      return NextResponse.json(
        { error: "Points have already been calculated for this game" },
        { status: 400 }
      )
    }

    // Fetch game data from NHL API
    // Note: We need to store NHL game ID (gamePk) in our database
    // For now, we'll try to get it from game data or skip NHL API integration
    // TODO: Store NHL gamePk in Game model
    
    // For now, we'll calculate points based on PlayerPerformance records
    // If PlayerPerformance doesn't exist, we'll need to create them from NHL API data
    
    const allPicks = game.picks
    const updatedPicks = []
    const leaguePointUpdates = new Map<string, number>() // leagueId -> points to add

    for (const pick of allPicks) {
      // Get player performance for this game
      let playerPerformance = await prisma.playerPerformance.findUnique({
        where: {
          playerId_gameId: {
            playerId: pick.playerId,
            gameId: game.id
          }
        }
      })

      // If no performance record, create one with zero stats
      // In production, this should be populated from NHL API
      if (!playerPerformance) {
        playerPerformance = await prisma.playerPerformance.create({
          data: {
            playerId: pick.playerId,
            gameId: game.id,
            goals: 0,
            assists: 0,
            points: 0,
            shortHandedPoints: 0
          }
        })
      }

      // Calculate points based on player position
      let pointsEarned = 0

      if (pick.player.position === 'Goalie') {
        // For goalies, we need goals against info
        // This should come from NHL API boxscore
        // For now, placeholder calculation
        // TODO: Fetch from NHL API and calculate properly
        const goaliePerformance: GoaliePerformance = {
          playerId: pick.playerId,
          goalsAgainst: 0, // Should come from NHL API
          assists: playerPerformance.assists,
          emptyNetGoals: 0, // Should come from NHL API
          shootoutGoals: 0 // Should come from NHL API
        }
        
        // Simplified calculation for now
        // In production, fetch full game data from NHL API
        pointsEarned = playerPerformance.assists * 5 // 5 points per assist
      } else {
        // For forwards and defensemen
        const goals: GoalEvent[] = []
        const assists: AssistEvent[] = []

        // Create goal events (we'll need to determine OT and shorthanded from NHL API)
        for (let i = 0; i < playerPerformance.goals; i++) {
          goals.push({
            playerId: pick.playerId,
            playerName: pick.playerName,
            position: pick.player.position as 'Forward' | 'Defense',
            isOvertime: false, // TODO: Get from NHL API
            isShorthanded: i < (playerPerformance.shortHandedPoints || 0),
            isEmptyNet: false
          })
        }

        // Create assist events
        for (let i = 0; i < playerPerformance.assists; i++) {
          assists.push({
            playerId: pick.playerId,
            playerName: pick.playerName,
            position: pick.player.position as 'Forward' | 'Defense',
            isOvertime: false, // TODO: Get from NHL API
            isShorthanded: i < (playerPerformance.shortHandedPoints || 0)
          })
        }

        pointsEarned = calculatePlayerTotalPoints(
          pick.player.position as 'Forward' | 'Defense',
          goals,
          assists
        )
      }

      // Update pick with calculated points
      const updatedPick = await prisma.pick.update({
        where: { id: pick.id },
        data: { pointsEarned }
      })

      updatedPicks.push(updatedPick)

      // Accumulate points for league membership update
      const currentLeaguePoints = leaguePointUpdates.get(pick.leagueId) || 0
      leaguePointUpdates.set(pick.leagueId, currentLeaguePoints + pointsEarned)
    }

    // Update league membership totals
    for (const [leagueId, pointsToAdd] of leaguePointUpdates) {
      // Get all picks for this league in this game to calculate total for each user
      const leaguePicks = allPicks.filter(p => p.leagueId === leagueId)
      
      for (const leaguePick of leaguePicks) {
        const pickPoints = updatedPicks.find(p => p.id === leaguePick.id)?.pointsEarned || 0
        
        // Update user's total points in this league
        await prisma.leagueMembership.updateMany({
          where: {
            leagueId: leagueId,
            userId: leaguePick.userId
          },
          data: {
            totalPoints: {
              increment: pickPoints
            }
          }
        })
      }
    }

    return NextResponse.json(
      { 
        message: "Points calculated successfully",
        picksUpdated: updatedPicks.length,
        picks: updatedPicks.map(p => ({
          id: p.id,
          playerName: p.playerName,
          pointsEarned: p.pointsEarned
        }))
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Calculate points error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

