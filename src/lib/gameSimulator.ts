import type {
  Player,
  Game,
  GamePlayerStats,
  GameResult,
  UserPick,
} from './types'
import { isForwardPosition, isDefensemanPosition, isGoaliePosition, normalizePosition, findPlayerStats } from './playerUtils'
import { SCORING, FORWARD_POSITIONS } from './scoringConstants'

/**
 * Simulates game stats for all players on the roster
 */
export function simulateGameStats(
  roster: Player[],
  gameResult: Game,
): GamePlayerStats[] {
  const playerStats: GamePlayerStats[] = []
  let totalGoals = 0
  let totalAssists = 0

  // Validate roster
  if (!roster || roster.length === 0) {
    console.warn('simulateGameStats: Empty roster provided, returning empty stats')
    return []
  }

  // Determine game outcome first
  const teamGoals = Math.floor(Math.random() * 6) + 1 // 1-6 goals
  const opponentGoals = Math.floor(Math.random() * 6) + 1 // 1-6 goals
  
  gameResult.teamGoals = teamGoals
  gameResult.opponentGoals = opponentGoals
  gameResult.wentToOT = teamGoals === opponentGoals
  gameResult.emptyNetGoals = teamGoals > opponentGoals && Math.random() > 0.5 
    ? Math.floor(Math.random() * 2) + 1 // 0-2 empty net goals
    : 0
  gameResult.shootoutOccurred = gameResult.wentToOT && Math.random() > 0.3

  // Track goals and assists we need to distribute
  const goalsToDistribute: Array<{ playerId: string; isShorthanded: boolean; isOTGoal: boolean }> = []
  const assistsToDistribute: Array<{ playerId: string; isShorthanded: boolean }> = []

  // Generate goals (weighted toward forwards)
  for (let i = 0; i < teamGoals; i++) {
    // Weight toward forwards (70%), defensemen (25%), goalies (5%)
    const rand = Math.random()
    let positionFilter: string[]
    if (rand < 0.7) {
      positionFilter = FORWARD_POSITIONS
    } else if (rand < 0.95) {
      positionFilter = ['D']
    } else {
      positionFilter = ['G']
    }

    const eligiblePlayers = roster.filter((p) => positionFilter.includes(p.position))
    if (eligiblePlayers.length === 0) continue

    const goalScorer = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)]
    const isShorthanded = Math.random() < 0.12 // ~12% chance
    const isOTGoal = gameResult.wentToOT && i === teamGoals - 1 && teamGoals === opponentGoals // Last goal if tied
    
    goalsToDistribute.push({
      playerId: goalScorer.id,
      isShorthanded,
      isOTGoal,
    })
  }

  // Generate assists (typically 1-2 per goal, sometimes 0, rarely 3)
  goalsToDistribute.forEach((goal) => {
    const numAssists = Math.random() < 0.1 ? 0 : Math.random() < 0.7 ? 1 : Math.random() < 0.95 ? 2 : 3
    const goalIsShorthanded = goal.isShorthanded

    for (let i = 0; i < numAssists; i++) {
      // Assists can come from any position
      const assistPlayer = roster[Math.floor(Math.random() * roster.length)]
      assistsToDistribute.push({
        playerId: assistPlayer.id,
        isShorthanded: goalIsShorthanded, // Assist inherits shorthanded status from goal
      })
    }
  })

  // Aggregate stats per player - ALWAYS include all roster players
  const statsMap = new Map<string, GamePlayerStats>()

  // Initialize stats for ALL players first
  roster.forEach((player) => {
    statsMap.set(player.id, {
      playerId: player.id,
      goals: [],
      assists: [],
      position: player.position,
    })
  })

  // Add goals
  goalsToDistribute.forEach((goal) => {
    const stats = statsMap.get(goal.playerId)
    if (stats) {
      stats.goals.push({
        isShorthanded: goal.isShorthanded,
        isOTGoal: goal.isOTGoal,
      })
    }
  })

  // Add assists
  assistsToDistribute.forEach((assist) => {
    const stats = statsMap.get(assist.playerId)
    if (stats) {
      stats.assists.push({
        isShorthanded: assist.isShorthanded,
      })
    }
  })

  // Always return stats for ALL players, even if they have no goals/assists
  const allStats = Array.from(statsMap.values())
  
  // Double-check: if somehow we're missing players, add them
  if (allStats.length !== roster.length) {
    console.warn(`Stats count (${allStats.length}) doesn't match roster size (${roster.length}), adding missing players`)
    roster.forEach((player) => {
      if (!statsMap.has(player.id)) {
        allStats.push({
          playerId: player.id,
          goals: [],
          assists: [],
          position: player.position,
        })
      }
    })
  }

  return allStats
}

/**
 * Calculates points for a goalie based on goals allowed and assists
 * Note: Empty netters and shootouts do not count against the goalie
 */
export function calculateGoalieScore(
  playerStats: GamePlayerStats,
  gameResult: Game,
): number {
  let points = 0

  // Calculate goals allowed (excluding empty netters and shootouts)
  // If shootout occurred, those goals don't count against goalie
  // In NHL, shootout goals are separate - the regulation/OT score is what matters
  // So if shootout occurred, we use the regulation/OT score only
  let goalsAllowed = gameResult.opponentGoals - gameResult.emptyNetGoals
  
  // If shootout occurred, the final score includes shootout result
  // But goals against in regulation/OT are what count for goalie stats
  // For simulation purposes, if shootout occurred, we assume the regulation/OT score
  // was tied, so goalsAllowed should be the regulation/OT goals only
  // Since we don't track regulation vs shootout goals separately, we'll use
  // the opponentGoals minus emptyNetGoals (shootout goals aren't added to opponentGoals)
  // Actually, in real NHL, if game goes to shootout, the score shown is the regulation/OT score
  // So opponentGoals already excludes shootout goals. We just need to exclude empty netters.
  goalsAllowed = gameResult.opponentGoals - gameResult.emptyNetGoals
  
  // Goalie scoring rules
  if (goalsAllowed === 0) {
    points += SCORING.GOALIE.SHUTOUT
  } else if (goalsAllowed <= 2) {
    points += SCORING.GOALIE.GOALS_1_2
  }
  // 3+ goals = 0 points

  // Assists: 5 points each
  points += playerStats.assists.length * SCORING.GOALIE.ASSIST

  return points
}

/**
 * Calculates points for a forward based on goals and assists
 */
export function calculateForwardScore(
  playerStats: GamePlayerStats,
): number {
  let points = 0

  // Calculate goal points
  playerStats.goals.forEach((goal) => {
    let goalPoints = goal.isOTGoal 
      ? SCORING.FORWARD.OT_GOAL 
      : SCORING.FORWARD.GOAL
    
    if (goal.isShorthanded) {
      goalPoints *= SCORING.MULTIPLIER.SHORTHANDED
    }
    
    points += goalPoints
  })

  // Calculate assist points
  playerStats.assists.forEach((assist) => {
    let assistPoints = SCORING.FORWARD.ASSIST
    
    if (assist.isShorthanded) {
      assistPoints *= SCORING.MULTIPLIER.SHORTHANDED
    }
    
    points += assistPoints
  })

  return points
}

/**
 * Calculates points for a defenseman based on goals and assists
 */
export function calculateDefensemanScore(
  playerStats: GamePlayerStats,
): number {
  let points = 0

  // Calculate goal points
  playerStats.goals.forEach((goal) => {
    let goalPoints = goal.isOTGoal 
      ? SCORING.DEFENSEMAN.OT_GOAL 
      : SCORING.DEFENSEMAN.GOAL
    
    if (goal.isShorthanded) {
      goalPoints *= SCORING.MULTIPLIER.SHORTHANDED
    }
    
    points += goalPoints
  })

  // Calculate assist points
  playerStats.assists.forEach((assist) => {
    let assistPoints = SCORING.DEFENSEMAN.ASSIST
    
    if (assist.isShorthanded) {
      assistPoints *= SCORING.MULTIPLIER.SHORTHANDED
    }
    
    points += assistPoints
  })

  return points
}

/**
 * Calculates points for a player based on their position
 */
export function calculatePlayerScore(
  playerStats: GamePlayerStats,
  gameResult: Game,
): number {
  const position = normalizePosition(playerStats.position)

  if (isGoaliePosition(position)) {
    return calculateGoalieScore(playerStats, gameResult)
  } else if (isForwardPosition(position)) {
    return calculateForwardScore(playerStats)
  } else if (isDefensemanPosition(position)) {
    return calculateDefensemanScore(playerStats)
  }

  // Unknown position - should not happen with normalized positions
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[CALCULATE-PLAYER-SCORE] Unknown position: ${playerStats.position} (normalized: ${position}) for player ${playerStats.playerId}`)
  }
  return 0
}

/**
 * Calculates team points: 1 point per goal past threshold
 * So 4 goals = 4 points, 5 goals = 5 points, etc.
 */
export function calculateTeamScore(teamGoals: number): number {
  if (teamGoals <= SCORING.TEAM.GOALS_THRESHOLD) return 0
  // Points = total goals (1 point per goal past threshold)
  return teamGoals
}

/**
 * Simulates a complete game and returns the result
 */
export function simulateGame(
  roster: Player[],
  game: Game,
): GameResult {
  // Validate inputs
  if (!roster || roster.length === 0) {
    console.error('simulateGame: Empty roster provided')
    // Return a minimal valid result
    return {
      gameId: game.id,
      playerStats: [],
      teamPoints: 0,
      completedAt: new Date().toISOString(),
    }
  }

  if (!game || !game.id) {
    console.error('simulateGame: Invalid game provided')
    throw new Error('Invalid game provided to simulateGame')
  }

  // Generate player stats
  const playerStats = simulateGameStats(roster, game)

  // Ensure we have stats for all players (even if empty)
  if (playerStats.length === 0) {
    console.warn('simulateGameStats returned empty array, creating empty stats for all players')
    roster.forEach((player) => {
      playerStats.push({
        playerId: player.id,
        goals: [],
        assists: [],
        position: player.position,
      })
    })
  }

  // Calculate team points
  const teamPoints = calculateTeamScore(game.teamGoals)

  return {
    gameId: game.id,
    playerStats,
    teamPoints,
    completedAt: new Date().toISOString(),
  }
}

/**
 * Calculates user scores based on their picks and game results
 */
export function calculateUserScores(
  picks: UserPick[],
  gameResult: GameResult,
  roster: Player[],
  game: Game,
): Map<string, number> {
  const userScores = new Map<string, number>()

  if (process.env.NODE_ENV === 'development') {
    console.log('[CALCULATE-USER-SCORES] Starting calculation:', {
      picksCount: picks.length,
      playerStatsCount: gameResult.playerStats.length,
      gameId: gameResult.gameId,
    })
  }

  picks.forEach((pick) => {
    if (pick.playerId === 'team') {
      // Team pick
      userScores.set(pick.userId, gameResult.teamPoints)
    } else {
      // Player pick - find matching player stats using shared utility
      const rosterPlayer = roster.find((p) => p.id === pick.playerId)
      
      if (rosterPlayer) {
        const playerStats = findPlayerStats(rosterPlayer, gameResult.playerStats)
        
        if (playerStats) {
          const points = calculatePlayerScore(playerStats, game)
          userScores.set(pick.userId, points)
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[CALCULATE-USER-SCORES] Player pick ${pick.playerId}:`, {
              goals: playerStats.goals.length,
              assists: playerStats.assists.length,
              position: playerStats.position,
              calculatedPoints: points,
            })
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[CALCULATE-USER-SCORES] No stats found for player pick ${pick.playerId}`)
          }
          userScores.set(pick.userId, 0)
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[CALCULATE-USER-SCORES] Player not found in roster: ${pick.playerId}`)
        }
        userScores.set(pick.userId, 0)
      }
    }
  })

  return userScores
}

