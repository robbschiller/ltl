import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"
import {
  fetchScheduleByDate,
  filterRedWingsGames,
  convertNHLWebGameToGame,
  formatDateForAPI
} from "@/lib/nhl-api"

// GET or POST: Sync games from NHL API to database
export async function GET(request: NextRequest) {
  return syncGames(request)
}

export async function POST(request: NextRequest) {
  return syncGames(request)
}

async function syncGames(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Fetch games for the next 30 days using the working api-web.nhle.com endpoint
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(today.getDate() + 30)
    
    const allGames = []
    const currentDate = new Date(today)
    
    // Fetch games for each date
    while (currentDate <= endDate) {
      const dateStr = formatDateForAPI(currentDate)
      try {
        const games = await fetchScheduleByDate(dateStr)
        const redWingsGames = filterRedWingsGames(games)
        allGames.push(...redWingsGames)
      } catch (error) {
        console.warn(`Failed to fetch games for ${dateStr}:`, error)
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const createdGames = []
    const updatedGames = []

    for (const nhlGame of allGames) {
      // Convert NHLWebGame to our database format
      const gameData = convertNHLWebGameToGame(nhlGame)
      
      // Normalize game date to same day (ignore time differences)
      const gameDateStart = new Date(gameData.gameDate)
      gameDateStart.setHours(0, 0, 0, 0)
      const gameDateEnd = new Date(gameDateStart)
      gameDateEnd.setHours(23, 59, 59, 999)

      // First try to find by date and opponent (exact match)
      let existingGame = await prisma.game.findFirst({
        where: {
          gameDate: {
            gte: gameDateStart,
            lte: gameDateEnd
          },
          opponent: gameData.opponent
        }
      })

      // If not found, try to find by date only (in case opponent name changed)
      // This helps fix incorrect seed data
      if (!existingGame) {
        existingGame = await prisma.game.findFirst({
          where: {
            gameDate: {
              gte: gameDateStart,
              lte: gameDateEnd
            }
          }
        })
        
        if (existingGame) {
          console.log(`🔄 Found game with different opponent: ${existingGame.opponent} → ${gameData.opponent}`)
          
          // Check if there are any picks for the old game - if so, keep it and update
          // If no picks, we'll update it (which overwrites the opponent)
          const picksCount = await prisma.pick.count({
            where: { gameId: existingGame.id }
          })
          
          if (picksCount > 0) {
            console.log(`⚠️  Game has ${picksCount} picks, updating in place: ${existingGame.opponent} → ${gameData.opponent}`)
          }
        }
      }

      // Find and delete other games on the same date (duplicate/incorrect games)
      // Only delete if they have no picks
      const whereClause: any = {
        gameDate: {
          gte: gameDateStart,
          lte: gameDateEnd
        }
      }
      
      if (existingGame) {
        whereClause.id = { not: existingGame.id }
      }
      
      const otherGamesOnDate = await prisma.game.findMany({
        where: whereClause
      })
      
      for (const otherGame of otherGamesOnDate) {
        const picksCount = await prisma.pick.count({
          where: { gameId: otherGame.id }
        })
        
        if (picksCount === 0) {
          // Delete duplicate/incorrect game with no picks
          await prisma.game.delete({
            where: { id: otherGame.id }
          })
          console.log(`🗑️  Deleted duplicate game: vs ${otherGame.opponent} on ${gameData.gameDate.toLocaleDateString()}`)
        } else {
          console.log(`⚠️  Keeping game with picks: vs ${otherGame.opponent} (${picksCount} picks)`)
        }
      }

      if (existingGame) {
        // Update existing game with correct data from NHL API
        const updated = await prisma.game.update({
          where: { id: existingGame.id },
          data: {
            ...gameData,
            gameDate: gameData.gameDate, // Update with correct time from API
            updatedAt: new Date(), // Ensure updatedAt is refreshed
          }
        })
        updatedGames.push(updated)
        console.log(`✅ Updated game: vs ${gameData.opponent} on ${gameData.gameDate.toLocaleDateString()}`)
      } else {
        // Create new game
        const created = await prisma.game.create({
          data: gameData
        })
        createdGames.push(created)
        console.log(`✅ Created game: vs ${gameData.opponent} on ${gameData.gameDate.toLocaleDateString()}`)
      }
    }

    return NextResponse.json(
      {
        message: "Games synced successfully",
        created: createdGames.length,
        updated: updatedGames.length,
        games: [...createdGames, ...updatedGames]
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Sync games error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

