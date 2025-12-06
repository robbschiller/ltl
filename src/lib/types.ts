export interface Player {
  id: string
  name: string
  number: string
  position: string
  goals?: number
  assists?: number
  points?: number
  gamesPlayed?: number
}

export interface Game {
  id: string
  opponent: string
  opponentLogo: string
  date: string
  time: string
  venue: string
  isHome: boolean
  status: 'upcoming' | 'completed'
  teamGoals: number
  opponentGoals: number
  wentToOT: boolean
  emptyNetGoals: number
  shootoutOccurred: boolean
  // Optional NHL API fields
  gameId?: number
  nhlGameData?: any
}

export interface GamePlayerStats {
  playerId: string
  goals: Array<{
    isShorthanded: boolean
    isOTGoal: boolean
  }>
  assists: Array<{
    isShorthanded: boolean
  }>
  position: string
}

export interface GameResult {
  gameId: string
  playerStats: GamePlayerStats[]
  teamPoints: number
  completedAt: string
}

export interface UserPick {
  userId: string
  gameId: string
  playerId: string | 'team'
  playerPosition?: string
}

export interface UserScore {
  userId: string
  gameId: string
  points: number
  totalSeasonPoints: number
}

export interface User {
  id: string
  name: string
}

