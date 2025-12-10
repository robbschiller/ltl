import type { GameResult, GamePlayerStats, Game, Player } from './types'
import { parseRealGameResults } from './parseGameResults'

/**
 * Adapts historical game data to match the current roster
 * Maps players from historical game to current roster by name/ID
 */
export function adaptHistoricalGameData(
  historicalStats: any,
  currentRoster: Player[],
  currentGame: Game,
): GameResult {
  const { boxscore, landing, playByPlay, game: historicalGame } = historicalStats

  // Parse the historical game results
  // We need to create a temporary roster that matches the historical game
  // For now, we'll use the current roster and let parseRealGameResults handle matching
  const parsedResult = parseRealGameResults(
    { boxscore, landing, playByPlay },
    currentGame,
    currentRoster,
    playByPlay,
  )

  // Now we need to map the parsed stats to current roster players
  // The parseRealGameResults should have already done some matching,
  // but we need to ensure all current roster players are represented
  const mappedPlayerStats: GamePlayerStats[] = []

  // Create a map of historical player stats by their roster ID
  const historicalStatsMap = new Map<string, GamePlayerStats>()
  parsedResult.playerStats.forEach((stats) => {
    historicalStatsMap.set(stats.playerId, stats)
  })

  // Map each current roster player
  // Ensure we have stats for ALL roster players
  if (currentRoster.length === 0) {
    console.warn('adaptHistoricalGameData: Empty roster provided')
    return {
      gameId: currentGame.id,
      playerStats: [],
      teamPoints: 0,
      completedAt: new Date().toISOString(),
    }
  }

  currentRoster.forEach((player) => {
    // Try to find matching historical stats
    const historicalStats = historicalStatsMap.get(player.id)

    if (historicalStats) {
      // Player was in historical game, use their stats
      mappedPlayerStats.push({
        playerId: player.id,
        goals: historicalStats.goals || [],
        assists: historicalStats.assists || [],
        position: player.position,
      })
    } else {
      // Player wasn't in historical game or couldn't be matched, set to 0
      mappedPlayerStats.push({
        playerId: player.id,
        goals: [],
        assists: [],
        position: player.position,
      })
    }
  })

  // Ensure we have stats for all players
  if (mappedPlayerStats.length === 0) {
    console.warn('adaptHistoricalGameData: No player stats mapped, creating empty stats')
    currentRoster.forEach((player) => {
      mappedPlayerStats.push({
        playerId: player.id,
        goals: [],
        assists: [],
        position: player.position,
      })
    })
  }

  // Use the historical game's final score and game details
  // The parsedResult should have updated the game object, but we'll use historicalGame data if available
  const redWingsScore = historicalGame?.redWingsScore || currentGame.teamGoals || 0
  const opponentScore = historicalGame?.opponentScore || currentGame.opponentGoals || 0
  
  // Update currentGame with historical game data
  currentGame.teamGoals = redWingsScore
  currentGame.opponentGoals = opponentScore
  currentGame.wentToOT = historicalGame?.wentToOT || currentGame.wentToOT || false
  currentGame.shootoutOccurred = historicalGame?.shootoutOccurred || currentGame.shootoutOccurred || false
  currentGame.emptyNetGoals = currentGame.emptyNetGoals || 0

  // Calculate team points based on actual goals (1 point per goal past 3)
  const teamPoints = redWingsScore > 3 ? redWingsScore : 0

  return {
    gameId: currentGame.id,
    playerStats: mappedPlayerStats,
    teamPoints,
    completedAt: new Date().toISOString(),
  }
}

/**
 * Fetches and adapts the most recent completed game's data
 */
export async function fetchAndAdaptLastGame(
  currentRoster: Player[],
  currentGame: Game,
): Promise<GameResult | null> {
  try {
    // Fetch last completed game
    const lastGameResponse = await fetch('/api/nhl/last-game')
    if (!lastGameResponse.ok) {
      console.log('No last completed game found')
      return null
    }

    const lastGame = await lastGameResponse.json()

    // Fetch historical stats for that game
    const statsResponse = await fetch(`/api/nhl/historical-stats?gameId=${lastGame.gameId}`)
    if (!statsResponse.ok) {
      console.log('Failed to fetch historical stats')
      return null
    }

    const historicalStats = await statsResponse.json()
    historicalStats.game = lastGame // Add game info to stats

    // Adapt the historical data to current roster
    return adaptHistoricalGameData(historicalStats, currentRoster, currentGame)
  } catch (error) {
    console.error('Error fetching and adapting last game:', error)
    return null
  }
}

