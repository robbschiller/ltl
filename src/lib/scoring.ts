// Scoring calculation system based on user-defined rules

export interface GoalEvent {
  playerId: string
  playerName: string
  position: 'Forward' | 'Defense' | 'Goalie'
  isOvertime: boolean
  isShorthanded: boolean
  isEmptyNet: boolean
}

export interface AssistEvent {
  playerId: string
  playerName: string
  position: 'Forward' | 'Defense' | 'Goalie'
  isOvertime: boolean
  isShorthanded: boolean
}

export interface GoaliePerformance {
  playerId: string
  goalsAgainst: number
  assists: number
  emptyNetGoals: number // Goals scored against the team when goalie was pulled
  shootoutGoals: number // Goals in shootout (don't count)
}

export interface TeamScoring {
  totalGoals: number
}

/**
 * Calculate points for a forward's goal
 * Rules: 2 points per regulation goal, +5 points if OT goal (7 total!), doubled if shorthanded
 */
export function calculateForwardGoalPoints(
  goal: GoalEvent
): number {
  let points = goal.isOvertime ? 7 : 2
  
  if (goal.isShorthanded) {
    points *= 2
  }
  
  return points
}

/**
 * Calculate points for a defenseman's goal
 * Rules: 3 points per regulation goal, +5 points if OT goal (8 total!), doubled if shorthanded
 */
export function calculateDefensemanGoalPoints(
  goal: GoalEvent
): number {
  let points = goal.isOvertime ? 8 : 3
  
  if (goal.isShorthanded) {
    points *= 2
  }
  
  return points
}

/**
 * Calculate points for a forward's assist
 * Rules: 1 point per assist, doubled if shorthanded
 */
export function calculateForwardAssistPoints(
  assist: AssistEvent
): number {
  let points = 1
  
  if (assist.isShorthanded) {
    points *= 2
  }
  
  return points
}

/**
 * Calculate points for a defenseman's assist
 * Rules: 1 point per assist, doubled if shorthanded
 */
export function calculateDefensemanAssistPoints(
  assist: AssistEvent
): number {
  let points = 1
  
  if (assist.isShorthanded) {
    points *= 2
  }
  
  return points
}

/**
 * Calculate points for a goalie
 * Rules:
 * - 5 points for a shutout
 * - 3 points for a 1 or 2 goal game
 * - 0 points for 3+ goals against
 * - 5 points per assist
 * - Empty netters and shootouts do not count against the goalie
 */
export function calculateGoaliePoints(
  performance: GoaliePerformance
): number {
  let points = 0
  
  // Calculate goals against (excluding empty netters and shootouts)
  const goalsAgainst = performance.goalsAgainst - performance.emptyNetGoals - performance.shootoutGoals
  
  // Shutout: 5 points
  if (goalsAgainst === 0) {
    points = 5
  }
  // 1 or 2 goals: 3 points
  else if (goalsAgainst <= 2) {
    points = 3
  }
  // 3+ goals: 0 points
  // points already 0
  
  // Add assist points: 5 points per assist
  points += performance.assists * 5
  
  return points
}

/**
 * Calculate team points
 * Rules: 1 point per goal past 3. So 4 goals = 4 points, 5 goals = 5 points, etc.
 */
export function calculateTeamPoints(
  teamScoring: TeamScoring
): number {
  if (teamScoring.totalGoals <= 3) {
    return 0
  }
  
  return teamScoring.totalGoals
}

/**
 * Calculate total points for a player based on their performance
 */
export function calculatePlayerTotalPoints(
  position: 'Forward' | 'Defense' | 'Goalie',
  goals: GoalEvent[],
  assists: AssistEvent[],
  goaliePerformance?: GoaliePerformance
): number {
  let totalPoints = 0
  
  if (position === 'Goalie' && goaliePerformance) {
    totalPoints = calculateGoaliePoints(goaliePerformance)
  } else if (position === 'Forward') {
    // Calculate goal points
    for (const goal of goals) {
      totalPoints += calculateForwardGoalPoints(goal)
    }
    // Calculate assist points
    for (const assist of assists) {
      totalPoints += calculateForwardAssistPoints(assist)
    }
  } else if (position === 'Defense') {
    // Calculate goal points
    for (const goal of goals) {
      totalPoints += calculateDefensemanGoalPoints(goal)
    }
    // Calculate assist points
    for (const assist of assists) {
      totalPoints += calculateDefensemanAssistPoints(assist)
    }
  }
  
  return totalPoints
}

/**
 * Validate scoring calculation inputs
 */
export function validateScoringInputs(
  position: string,
  goals: GoalEvent[],
  assists: AssistEvent[],
  goaliePerformance?: GoaliePerformance
): { valid: boolean; error?: string } {
  if (!['Forward', 'Defense', 'Goalie'].includes(position)) {
    return { valid: false, error: 'Invalid position' }
  }
  
  if (position === 'Goalie' && !goaliePerformance) {
    return { valid: false, error: 'Goalie performance required for goalies' }
  }
  
  if (position !== 'Goalie' && (goals.length === 0 && assists.length === 0)) {
    // This is fine - player might not have scored
    return { valid: true }
  }
  
  return { valid: true }
}

