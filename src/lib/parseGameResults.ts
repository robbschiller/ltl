import type { GameResult, GamePlayerStats, Game, Player } from './types'

/**
 * Parse real NHL API boxscore data into our GameResult format
 */
export function parseRealGameResults(
  apiData: any,
  game: Game,
  roster: Player[],
): GameResult {
  const boxscore = apiData.boxscore
  const landing = apiData.landing
  
  // Extract team scores
  let redWingsScore = 0
  let opponentScore = 0
  let wentToOT = false
  let shootoutOccurred = false
  let emptyNetGoals = 0
  
  // Parse boxscore structure (this will depend on actual NHL API response)
  // The structure may vary, so we'll try multiple possible paths
  let boxscoreData = boxscore
  
  // Try different possible structures
  if (boxscore?.boxscore) {
    boxscoreData = boxscore.boxscore
  } else if (boxscore?.gameState !== undefined) {
    // Boxscore might be at root level
    boxscoreData = boxscore
  }
  
  if (boxscoreData) {
    const homeTeam = boxscoreData.homeTeam
    const awayTeam = boxscoreData.awayTeam
    
    const isHome = game.isHome
    redWingsScore = isHome ? (homeTeam?.score || 0) : (awayTeam?.score || 0)
    opponentScore = isHome ? (awayTeam?.score || 0) : (homeTeam?.score || 0)
    
    // Check for OT/shootout
    if (boxscoreData.periodDescriptor) {
      const periodType = boxscoreData.periodDescriptor.periodType
      wentToOT = periodType === 'OT' || periodType === 'SO'
      shootoutOccurred = periodType === 'SO'
    }
  }
  
  // Parse player stats from boxscore
  const playerStats: GamePlayerStats[] = []
  
  // The structure will vary, but we need to find Red Wings players
  // and extract their goals, assists, and position
  let statsData = null
  if (boxscore?.boxscore?.playerByGameStats) {
    statsData = boxscore.boxscore.playerByGameStats
  } else if (boxscore?.playerByGameStats) {
    statsData = boxscore.playerByGameStats
  } else if (landing?.boxscore?.playerByGameStats) {
    statsData = landing.boxscore.playerByGameStats
  }
  
  if (statsData) {
    const stats = statsData
    
    // Find Red Wings team ID (we'll need to match this)
    const boxscoreForTeam = boxscore?.boxscore || boxscore
    const redWingsTeamId = game.isHome 
      ? boxscoreForTeam?.homeTeam?.id 
      : boxscoreForTeam?.awayTeam?.id
    
    // Iterate through player stats
    if (Array.isArray(stats)) {
      stats.forEach((playerStat: any) => {
        if (playerStat.teamId === redWingsTeamId) {
          // Match player to roster by ID
          const playerId = String(playerStat.playerId)
          const rosterPlayer = roster.find(p => {
            // Try to match by NHL player ID if available
            const nhlId = (p as any).playerId || (p as any).id
            return String(nhlId) === playerId || p.id === playerId
          })
          
          if (rosterPlayer) {
            // Parse goals
            const goals: Array<{ isShorthanded: boolean; isOTGoal: boolean }> = []
            const assists: Array<{ isShorthanded: boolean }> = []
            
            // Extract goals and assists from player stats
            // This structure will need to be adapted based on actual API response
            const goalsCount = playerStat.goals || 0
            const assistsCount = playerStat.assists || 0
            
            // For now, we'll need to check play-by-play or goal details
            // to determine if goals are shorthanded or OT goals
            // This is a simplified version - we may need to enhance this
            
            for (let i = 0; i < goalsCount; i++) {
              goals.push({
                isShorthanded: false, // Will need to parse from play-by-play
                isOTGoal: wentToOT && i === goalsCount - 1, // Last goal might be OT
              })
            }
            
            for (let i = 0; i < assistsCount; i++) {
              assists.push({
                isShorthanded: false, // Will need to parse from play-by-play
              })
            }
            
            playerStats.push({
              playerId: rosterPlayer.id,
              goals,
              assists,
              position: rosterPlayer.position,
            })
          }
        }
      })
    }
  }
  
  // Calculate team points (1 point per goal past 3)
  const teamPoints = redWingsScore > 3 ? redWingsScore : 0
  
  // Update game with actual scores
  game.teamGoals = redWingsScore
  game.opponentGoals = opponentScore
  game.wentToOT = wentToOT
  game.shootoutOccurred = shootoutOccurred
  game.emptyNetGoals = emptyNetGoals
  
  return {
    gameId: game.id,
    playerStats,
    teamPoints,
    completedAt: new Date().toISOString(),
  }
}

