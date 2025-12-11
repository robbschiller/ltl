import { NextResponse } from 'next/server'
import { getRedWingsCurrentSeasonSchedule, fetchBoxscore, getGamePlayByPlay } from '@/lib/nhlApi'

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
      fetchBoxscore(gameId),
      getGamePlayByPlay(gameId),
    ])
    
    // Verify boxscore has player stats
    if (!boxscore?.playerByGameStats) {
      console.error('[LAST-GAME-BOXSCORE] ERROR: No playerByGameStats in boxscore')
      return NextResponse.json(
        { error: 'Boxscore missing player stats', boxscoreKeys: Object.keys(boxscore || {}) },
        { status: 500 }
      )
    }
    
    const homeHasPlayers = !!boxscore.playerByGameStats.homeTeam
    const awayHasPlayers = !!boxscore.playerByGameStats.awayTeam
    console.log('[LAST-GAME-BOXSCORE] Player stats found - home:', homeHasPlayers, 'away:', awayHasPlayers)
    
    // Extract scores from the schedule game (they're available there)
    const isHome = lastGame.homeTeam.abbrev === 'DET'
    const redWingsTeam = isHome ? lastGame.homeTeam : lastGame.awayTeam
    const opponentTeam = isHome ? lastGame.awayTeam : lastGame.homeTeam
    
    const redWingsScore = redWingsTeam.score ?? 0
    const opponentScore = opponentTeam.score ?? 0
    
    // Step 5: Return the data with scores from schedule
    return NextResponse.json({
      gameId,
      game: lastGame,
      boxscore,
      playByPlay,
      scores: {
        redWingsScore,
        opponentScore,
        isHome,
        homeScore: lastGame.homeTeam.score ?? 0,
        awayScore: lastGame.awayTeam.score ?? 0,
      },
    })
  } catch (error) {
    console.error('[LAST-GAME-BOXSCORE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last game boxscore', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

