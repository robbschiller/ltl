import type {
  Game,
  GamePlayerStats,
  GameResult,
  Player,
  UserPick,
} from './types'
import { isForwardPosition, isDefensemanPosition, isGoaliePosition, normalizePosition, findPlayerStats } from './playerUtils'
import { SCORING } from './scoringConstants'

export function getTopScorerIds(roster: Player[], limit = SCORING.LONE_WOLF.TOP_POINTS_COUNT): Set<string> {
  const sorted = [...roster].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  return new Set(sorted.slice(0, limit).map((player) => player.id))
}

function calculateLoneWolfBonus(playerStats: GamePlayerStats, isLoneWolf: boolean): number {
  if (!isLoneWolf) return 0
  if (playerStats.goals.length > 0) return SCORING.LONE_WOLF.GOAL_BONUS
  if (playerStats.assists.length > 0) return SCORING.LONE_WOLF.ASSIST_BONUS
  return 0
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
  options?: { isLoneWolf?: boolean },
): number {
  const position = normalizePosition(playerStats.position)
  const loneWolfBonus = calculateLoneWolfBonus(playerStats, Boolean(options?.isLoneWolf))

  if (isGoaliePosition(position)) {
    return calculateGoalieScore(playerStats, gameResult) + loneWolfBonus
  } else if (isForwardPosition(position)) {
    return calculateForwardScore(playerStats) + loneWolfBonus
  } else if (isDefensemanPosition(position)) {
    return calculateDefensemanScore(playerStats) + loneWolfBonus
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
 * Calculates user scores based on their picks and game results
 */
export function calculateUserScores(
  picks: UserPick[],
  gameResult: GameResult,
  roster: Player[],
  game: Game,
): Map<string, number> {
  const userScores = new Map<string, number>()
  const topScorerIds = getTopScorerIds(roster)
  const teamScore = calculateTeamScore(game.teamGoals)

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
      userScores.set(pick.userId, teamScore)
    } else {
      // Player pick - find matching player stats using shared utility
      const rosterPlayer = roster.find((p) => p.id === pick.playerId)
      
      if (rosterPlayer) {
        const playerStats = findPlayerStats(rosterPlayer, gameResult.playerStats)
        
        if (playerStats) {
          const isLoneWolf = !topScorerIds.has(rosterPlayer.id)
          const points = calculatePlayerScore(playerStats, game, { isLoneWolf })
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

