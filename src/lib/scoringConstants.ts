/**
 * Scoring rules and constants for the game
 */

// Position codes
export const POSITIONS = {
  CENTER: 'C',
  LEFT_WING: 'LW',
  RIGHT_WING: 'RW',
  DEFENSEMAN: 'D',
  GOALIE: 'G',
  // Alternative formats from NHL API
  LEFT_WING_SHORT: 'L',
  RIGHT_WING_SHORT: 'R',
} as const

export const FORWARD_POSITIONS = [POSITIONS.CENTER, POSITIONS.LEFT_WING, POSITIONS.RIGHT_WING, POSITIONS.LEFT_WING_SHORT, POSITIONS.RIGHT_WING_SHORT]

// Scoring points
export const SCORING = {
  FORWARD: {
    GOAL: 2,
    ASSIST: 1,
    OT_GOAL: 7,
  },
  DEFENSEMAN: {
    GOAL: 3,
    ASSIST: 1,
    OT_GOAL: 8,
  },
  GOALIE: {
    SHUTOUT: 5,
    GOALS_1_2: 3,
    ASSIST: 5,
  },
  TEAM: {
    GOALS_THRESHOLD: 3, // Points start after this many goals
  },
  MULTIPLIER: {
    SHORTHANDED: 2,
  },
} as const

