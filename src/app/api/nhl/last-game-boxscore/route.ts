import { NextResponse } from 'next/server'
import { getRedWingsCurrentSeasonSchedule, getGameBoxscore, getGamePlayByPlay } from '@/lib/nhlApi'

/**
 * GET /api/nhl/last-game-boxscore
 * Gets the boxscore for the most recent completed Red Wings game
 * Follows the flow:
 * 1. Get season schedule for DET/now
 * 2. Find latest game with gameState = "OFF" (or "FINAL")
 * 3. Extract gameId
 * 4. Get boxscore and play-by-play
 * 5. Return the data
 */
export async function GET() {
  try {
    console.log('[LAST-GAME-BOXSCORE] Fetching current season schedule...')
    
    // Step 1: Get season schedule
    const games = await getRedWingsCurrentSeasonSchedule()
    console.log(`[LAST-GAME-BOXSCORE] Found ${games.length} games in season schedule`)
    
    // Step 2: Find latest completed game (gameState = "OFF" or "FINAL")
    const completedGames = games.filter(game => 
      game.gameState === 'OFF' || 
      game.gameState === 'FINAL' ||
      game.gameState === 'OFFICIAL'
    )
    
    console.log(`[LAST-GAME-BOXSCORE] Found ${completedGames.length} completed games`)
    
    if (completedGames.length === 0) {
      return NextResponse.json(
        { error: 'No completed games found this season' },
        { status: 404 }
      )
    }
    
    // Get the most recent completed game (last in sorted array)
    const lastGame = completedGames[completedGames.length - 1]
    const gameId = lastGame.id
    
    console.log(`[LAST-GAME-BOXSCORE] Using game ID: ${gameId}`)
    console.log(`[LAST-GAME-BOXSCORE] Game: ${lastGame.awayTeam.abbrev} @ ${lastGame.homeTeam.abbrev}, Date: ${lastGame.startTimeUTC}`)
    
    // Step 3 & 4: Get boxscore and play-by-play
    console.log(`[LAST-GAME-BOXSCORE] Fetching boxscore and play-by-play...`)
    const [boxscore, playByPlay] = await Promise.all([
      getGameBoxscore(gameId),
      getGamePlayByPlay(gameId),
    ])
    
    console.log(`[LAST-GAME-BOXSCORE] Successfully fetched data for game ${gameId}`)
    
    // Step 5: Return the data
    return NextResponse.json({
      gameId,
      game: lastGame,
      boxscore,
      playByPlay,
    })
  } catch (error) {
    console.error('[LAST-GAME-BOXSCORE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last game boxscore', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

