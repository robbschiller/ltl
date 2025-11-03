import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// POST: Fix incorrect games by syncing from NHL API and updating existing ones
// This will update all existing games with correct data from NHL API
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Import sync functions
    const { fetchScheduleByDate, filterRedWingsGames, convertNHLWebGameToGame, formatDateForAPI } = await import("@/lib/nhl-api")

    // Get all existing games that are scheduled or in_progress
    const existingGames = await prisma.game.findMany({
      where: {
        status: {
          in: ['scheduled', 'in_progress']
        }
      },
      orderBy: {
        gameDate: 'asc'
      }
    })

    const today = new Date()
    const endDate = new Date()
    endDate.setDate(today.getDate() + 30)
    
    // Fetch real games from NHL API for the next 30 days
    const allNHLGames: any[] = []
    const currentDate = new Date(today)
    
    while (currentDate <= endDate) {
      const dateStr = formatDateForAPI(currentDate)
      try {
        const games = await fetchScheduleByDate(dateStr)
        const redWingsGames = filterRedWingsGames(games)
        allNHLGames.push(...redWingsGames)
      } catch (error) {
        console.warn(`Failed to fetch games for ${dateStr}:`, error)
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const updatedGames = []
    const deletedGames = []

    // Match and update existing games with NHL API data
    for (const existingGame of existingGames) {
      const gameDate = new Date(existingGame.gameDate)
      gameDate.setHours(0, 0, 0, 0)
      
      // Try to find matching NHL game for this date
      const matchingNHLGame = allNHLGames.find(nhlGame => {
        const nhlDate = new Date(nhlGame.startTimeUTC)
        nhlDate.setHours(0, 0, 0, 0)
        
        // Match if same day
        return nhlDate.getTime() === gameDate.getTime()
      })

      if (matchingNHLGame) {
        // Update existing game with correct data
        const gameData = convertNHLWebGameToGame(matchingNHLGame)
        
        await prisma.game.update({
          where: { id: existingGame.id },
          data: gameData
        })
        
        updatedGames.push({
          id: existingGame.id,
          oldOpponent: existingGame.opponent,
          newOpponent: gameData.opponent,
          date: gameData.gameDate.toISOString()
        })
      } else {
        // If no matching NHL game found, this game might be incorrect seed data
        // Check if it's more than a day old and has no picks
        const daysOld = (today.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysOld > 1) {
          // Check if anyone has picks for this game
          const picksCount = await prisma.pick.count({
            where: { gameId: existingGame.id }
          })
          
          // If no picks, delete the incorrect game
          if (picksCount === 0) {
            await prisma.game.delete({
              where: { id: existingGame.id }
            })
            deletedGames.push({
              id: existingGame.id,
              opponent: existingGame.opponent,
              date: existingGame.gameDate.toISOString()
            })
          }
        }
      }
    }

    // Also add any new games from NHL API that don't exist in database
    const createdGames = []
    for (const nhlGame of allNHLGames) {
      const gameData = convertNHLWebGameToGame(nhlGame)
      const gameDateStart = new Date(gameData.gameDate)
      gameDateStart.setHours(0, 0, 0, 0)
      const gameDateEnd = new Date(gameDateStart)
      gameDateEnd.setHours(23, 59, 59, 999)

      const existingGame = await prisma.game.findFirst({
        where: {
          gameDate: {
            gte: gameDateStart,
            lte: gameDateEnd
          },
          opponent: gameData.opponent
        }
      })

      if (!existingGame) {
        const created = await prisma.game.create({
          data: gameData
        })
        createdGames.push(created)
      }
    }

    return NextResponse.json({
      message: "Games fixed and synced from NHL API",
      updated: updatedGames.length,
      deleted: deletedGames.length,
      created: createdGames.length,
      updates: updatedGames,
      deletions: deletedGames
    }, { status: 200 })
  } catch (error) {
    console.error("Fix games error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

