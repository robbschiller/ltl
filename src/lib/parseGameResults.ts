import type { GameResult, GamePlayerStats, Game, Player } from './types'

/**
 * Parse real NHL API boxscore data into our GameResult format
 * Enhanced to handle play-by-play data for shorthanded goals, OT goals, and empty net goals
 */
export function parseRealGameResults(
  apiData: any,
  game: Game,
  roster: Player[],
  playByPlay?: any,
): GameResult {
  const boxscore = apiData.boxscore
  const landing = apiData.landing
  const pbp = playByPlay || apiData.playByPlay
  
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
  
  // Parse play-by-play to extract goal details (shorthanded, OT, empty net)
  const goalDetails = new Map<number, Array<{
    playerId: number
    isShorthanded: boolean
    isOTGoal: boolean
    isEmptyNet: boolean
    period: number
  }>>()
  
  const assistDetails = new Map<number, Array<{
    playerId: number
    isShorthanded: boolean
  }>>()
  
  // Parse play-by-play if available
  if (pbp) {
    const plays = (pbp as any)?.plays || (pbp as any)?.playsAllPlays || []
    const redWingsTeamId = game.isHome 
      ? (boxscoreData?.homeTeam?.id)
      : (boxscoreData?.awayTeam?.id)
    
    plays.forEach((play: any) => {
      if (play.typeDescKey === 'goal' && play.details?.scoringPlayerId) {
        const scoringPlayerId = play.details.scoringPlayerId
        const isRedWingsGoal = play.teamId === redWingsTeamId
        const period = play.periodDescriptor?.number || 1
        const isOT = period > 3 || play.periodDescriptor?.periodType === 'OT'
        const isShorthanded = play.situationCode === 'SH' || play.details?.situationCode === 'SH'
        const isEmptyNet = play.details?.emptyNet === true || play.details?.emptyNetGoal === true
        
        if (isRedWingsGoal) {
          if (!goalDetails.has(scoringPlayerId)) {
            goalDetails.set(scoringPlayerId, [])
          }
          goalDetails.get(scoringPlayerId)!.push({
            playerId: scoringPlayerId,
            isShorthanded,
            isOTGoal: isOT,
            isEmptyNet,
            period,
          })
          
          // Track assists
          const assistPlayerIds = play.details?.assistPlayerIds || []
          assistPlayerIds.forEach((assistPlayerId: number) => {
            if (!assistDetails.has(assistPlayerId)) {
              assistDetails.set(assistPlayerId, [])
            }
            assistDetails.get(assistPlayerId)!.push({
              playerId: assistPlayerId,
              isShorthanded,
            })
          })
        }
      }
    })
    
    // Count empty net goals
    goalDetails.forEach((goals) => {
      goals.forEach((goal) => {
        if (goal.isEmptyNet) {
          emptyNetGoals++
        }
      })
    })
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
          // Match player to roster by ID or name
          const playerId = String(playerStat.playerId)
          const playerName = `${playerStat.firstName?.default || ''} ${playerStat.lastName?.default || ''}`.trim()
          
          const rosterPlayer = roster.find(p => {
            // Try to match by NHL player ID if available
            const nhlId = (p as any).playerId || (p as any).id
            if (String(nhlId) === playerId || p.id === playerId) return true
            // Fallback: match by name
            if (p.name === playerName) return true
            // Match by last name if first name differs
            const pLastName = p.name.split(' ').pop()
            const statLastName = playerStat.lastName?.default || playerName.split(' ').pop()
            return pLastName === statLastName
          })
          
          if (rosterPlayer) {
            // Get goal details from play-by-play if available
            const goals: Array<{ isShorthanded: boolean; isOTGoal: boolean }> = []
            const assists: Array<{ isShorthanded: boolean }> = []
            
            const goalsCount = playerStat.goals || 0
            const assistsCount = playerStat.assists || 0
            
            // Use play-by-play data if available, otherwise use defaults
            const pbpGoals = goalDetails.get(playerStat.playerId) || []
            const pbpAssists = assistDetails.get(playerStat.playerId) || []
            
            // Map goals with play-by-play details
            for (let i = 0; i < goalsCount; i++) {
              const pbpGoal = pbpGoals[i]
              if (pbpGoal) {
                goals.push({
                  isShorthanded: pbpGoal.isShorthanded,
                  isOTGoal: pbpGoal.isOTGoal,
                })
              } else {
                // Fallback: assume last goal is OT if game went to OT
                goals.push({
                  isShorthanded: false,
                  isOTGoal: wentToOT && i === goalsCount - 1,
                })
              }
            }
            
            // Map assists with play-by-play details
            for (let i = 0; i < assistsCount; i++) {
              const pbpAssist = pbpAssists[i]
              if (pbpAssist) {
                assists.push({
                  isShorthanded: pbpAssist.isShorthanded,
                })
              } else {
                assists.push({
                  isShorthanded: false,
                })
              }
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
  
  // Update game with actual scores (if not already set)
  if (game.teamGoals === 0 || game.opponentGoals === 0) {
    game.teamGoals = redWingsScore
    game.opponentGoals = opponentScore
  }
  game.wentToOT = wentToOT
  game.shootoutOccurred = shootoutOccurred
  game.emptyNetGoals = emptyNetGoals
  
  // Calculate team points (1 point per goal past 3)
  const teamPoints = game.teamGoals > 3 ? game.teamGoals : 0
  
  return {
    gameId: game.id,
    playerStats,
    teamPoints,
    completedAt: new Date().toISOString(),
  }
}

