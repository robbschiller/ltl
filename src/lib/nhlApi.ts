/**
 * NHL API Client
 * 
 * Documentation: https://github.com/Zmalski/NHL-API-Reference
 * 
 * Two main APIs:
 * 1. Web API (api-web.nhle.com/v1) - schedules, scores, rosters, gamecenter
 * 2. Stats API (api.nhle.com/stats/rest) - leaders, player/team stats, reports
 */

const NHL_WEB_BASE = 'https://api-web.nhle.com/v1'
const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest'

/**
 * Generic fetch wrapper for NHL APIs
 */
async function nhlFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Accept': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`NHL API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

// ============================================================================
// Web API - Schedule & Games
// ============================================================================

export interface ScheduleResponse {
  gameWeek: Array<{
    date: string
    dayAbbrev: string
    numberOfGames: number
    games: Game[]
  }>
  nextStartDate?: string
  previousStartDate?: string
}

export interface Game {
  id: number
  season: number
  gameType: number
  venue: {
    default: string
  }
  startTimeUTC: string
  gameState: string
  gameScheduleState: string
  awayTeam: Team
  homeTeam: Team
  periodDescriptor?: {
    number: number
    periodType: string
    maxRegulationPeriods: number
  }
  gameOutcome?: {
    lastPeriodType: string
  }
}

export interface Team {
  id: number
  commonName: {
    default: string
  }
  placeName: {
    default: string
  }
  abbrev: string
  logo: string
  darkLogo: string
  score?: number
}

/**
 * Get today's schedule
 */
export async function getTodaySchedule(): Promise<ScheduleResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/schedule/now`)
}

/**
 * Get schedule for a specific date (YYYY-MM-DD)
 */
export async function getScheduleForDate(date: string): Promise<ScheduleResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/schedule/${date}`)
}

// ============================================================================
// Web API - Standings
// ============================================================================

export interface StandingsResponse {
  // Structure depends on NHL API response
  [key: string]: unknown
}

/**
 * Get current standings
 */
export async function getStandingsNow(): Promise<StandingsResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/standings/now`)
}

/**
 * Get standings for a specific date (YYYY-MM-DD)
 */
export async function getStandingsForDate(date: string): Promise<StandingsResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/standings/${date}`)
}

// ============================================================================
// Web API - Team Information
// ============================================================================

export interface Player {
  id: number
  firstName: {
    default: string
  }
  lastName: {
    default: string
  }
  sweaterNumber: number | null
  position: string
  birthDate?: string
}

export interface RosterResponse {
  forwards: Player[]
  defensemen: Player[]
  goalies: Player[]
}

/**
 * Get current roster for a team (by abbreviation: DET, SEA, etc.)
 * Note: Uses season format (e.g., 20242025) as /current may redirect
 */
export async function getTeamRosterCurrent(teamAbbrev: string): Promise<RosterResponse> {
  // Get current season (format: YYYY(YYYY+1), e.g., 20242025 for 2024-25 season)
  // NHL season starts in October (month 9), so if month >= 9, we're in the new season
  const now = new Date()
  const currentYear = now.getFullYear()
  const month = now.getMonth() // 0-11, where 9 = October
  const seasonStartYear = month >= 9 ? currentYear : currentYear - 1
  const seasonEndYear = seasonStartYear + 1
  const season = `${seasonStartYear}${seasonEndYear}` // Full 4-digit year
  
  return nhlFetch(`${NHL_WEB_BASE}/roster/${teamAbbrev}/${season}`)
}

/**
 * Get roster for a specific season
 * @param teamAbbrev - Team abbreviation (DET, SEA, etc.)
 * @param season - Season format: YYYY(YY+1), e.g., "20242025" for 2024-25 season
 */
export async function getTeamRosterForSeason(
  teamAbbrev: string,
  season: string
): Promise<RosterResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/roster/${teamAbbrev}/${season}`)
}

/**
 * Get club stats for a team (now)
 */
export async function getClubStatsNow(teamAbbrev: string): Promise<unknown> {
  return nhlFetch(`${NHL_WEB_BASE}/club-stats/${teamAbbrev}/now`)
}

/**
 * Get team's season schedule (current season)
 */
export async function getClubScheduleSeason(teamAbbrev: string): Promise<unknown> {
  return nhlFetch(`${NHL_WEB_BASE}/club-schedule-season/${teamAbbrev}/now`)
}

/**
 * Get all games for Red Wings in a season, sorted by date
 * Returns only regular season games (gameType: 2)
 */
export async function getRedWingsSeasonSchedule(season: string): Promise<Game[]> {
  const schedule = await nhlFetch<any>(`${NHL_WEB_BASE}/club-schedule-season/DET/${season}`)
  
  const games: Game[] = []
  if (schedule.gameWeek) {
    schedule.gameWeek.forEach((week: any) => {
      if (week.games) {
        // Filter for Red Wings games and regular season only (gameType: 2)
        week.games.forEach((game: Game) => {
          const isRedWingsGame = game.awayTeam.abbrev === 'DET' || game.homeTeam.abbrev === 'DET'
          const isRegularSeason = game.gameType === 2
          if (isRedWingsGame && isRegularSeason) {
            games.push(game)
          }
        })
      }
    })
  }
  
  // Sort by date (startTimeUTC)
  games.sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime())
  
  return games
}

/**
 * Get all games for a team in a season
 * Returns games sorted by date
 */
export async function getTeamSeasonSchedule(teamAbbrev: string, season: string): Promise<Game[]> {
  // The club-schedule-season endpoint returns the full season schedule
  const schedule = await nhlFetch<any>(`${NHL_WEB_BASE}/club-schedule-season/${teamAbbrev}/${season}`)
  
  // Extract games from the schedule structure
  const games: Game[] = []
  if (schedule.gameWeek) {
    schedule.gameWeek.forEach((week: any) => {
      if (week.games) {
        games.push(...week.games)
      }
    })
  }
  
  // Sort by date (startTimeUTC)
  games.sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime())
  
  return games
}

// ============================================================================
// Web API - Gamecenter (Game Details)
// ============================================================================

export interface BoxscoreResponse {
  // Structure depends on NHL API response
  [key: string]: unknown
}

export interface PlayByPlayResponse {
  // Structure depends on NHL API response
  [key: string]: unknown
}

export interface LandingResponse {
  // Structure depends on NHL API response
  [key: string]: unknown
}

/**
 * Get game boxscore
 */
export async function getGameBoxscore(gameId: number): Promise<BoxscoreResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/gamecenter/${gameId}/boxscore`)
}

/**
 * Get game play-by-play
 */
export async function getGamePlayByPlay(gameId: number): Promise<PlayByPlayResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/gamecenter/${gameId}/play-by-play`)
}

/**
 * Get game landing page (summary, lines, etc.)
 */
export async function getGameLanding(gameId: number): Promise<LandingResponse> {
  return nhlFetch(`${NHL_WEB_BASE}/gamecenter/${gameId}/landing`)
}

// ============================================================================
// Stats API - Player/Team Statistics
// ============================================================================

export interface SkaterSummaryResponse {
  data: Array<{
    playerId: number
    firstName: string
    lastName: string
    teamAbbrev: string
    position: string
    gamesPlayed: number
    goals: number
    assists: number
    points: number
    // ... more stats
    [key: string]: unknown
  }>
}

/**
 * Get skater summary stats for a season
 * @param seasonId - e.g., 20232024 for 2023-24 season
 * @param gameTypeId - 2 for regular season, 3 for playoffs
 */
export async function getSkaterSummaryForSeason(
  seasonId: number,
  gameTypeId: number = 2
): Promise<SkaterSummaryResponse> {
  const params = new URLSearchParams({
    limit: '-1',
    sort: 'points',
    dir: 'desc',
    cayenneExp: `seasonId=${seasonId} and gameTypeId=${gameTypeId}`,
  })

  return nhlFetch(`${NHL_STATS_BASE}/en/skater/summary?${params.toString()}`)
}

/**
 * Get goalie summary stats for a season
 */
export async function getGoalieSummaryForSeason(
  seasonId: number,
  gameTypeId: number = 2
): Promise<unknown> {
  const params = new URLSearchParams({
    limit: '-1',
    sort: 'wins',
    dir: 'desc',
    cayenneExp: `seasonId=${seasonId} and gameTypeId=${gameTypeId}`,
  })

  return nhlFetch(`${NHL_STATS_BASE}/en/goalie/summary?${params.toString()}`)
}

/**
 * Get team player stats for a season
 * Returns skater and goalie stats filtered by team
 */
export async function getTeamPlayerStats(
  teamAbbrev: string,
  seasonId: number,
  gameTypeId: number = 2
): Promise<{
  skaters: Array<{
    playerId: number
    goals: number
    assists: number
    points: number
    gamesPlayed: number
  }>
  goalies: Array<{
    playerId: number
    goals: number
    assists: number
    points: number
    gamesPlayed: number
  }>
}> {
  try {
    // Get skater stats
    const skaterParams = new URLSearchParams({
      limit: '-1',
      sort: 'points',
      dir: 'desc',
      cayenneExp: `seasonId=${seasonId} and gameTypeId=${gameTypeId} and teamAbbrev="${teamAbbrev}"`,
    })

    const skaterResponse = await nhlFetch<SkaterSummaryResponse>(
      `${NHL_STATS_BASE}/en/skater/summary?${skaterParams.toString()}`
    )

    const skaters = (skaterResponse.data || []).map((player) => ({
      playerId: player.playerId,
      goals: player.goals || 0,
      assists: player.assists || 0,
      points: player.points || 0,
      gamesPlayed: player.gamesPlayed || 0,
    }))

    // Goalies don't typically have goals/assists in the same way, but we'll include them
    // For now, we'll set goalie stats to 0 for goals/assists/points
    // You might want to fetch goalie-specific stats separately if needed
    const goalies: Array<{
      playerId: number
      goals: number
      assists: number
      points: number
      gamesPlayed: number
    }> = []

    return { skaters, goalies }
  } catch (error) {
    console.error('Error fetching team player stats:', error)
    return { skaters: [], goalies: [] }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a game between two teams in a schedule response
 */
export function findGameBetweenTeams(
  schedule: ScheduleResponse,
  team1Abbrev: string,
  team2Abbrev: string
): Game | null {
  for (const week of schedule.gameWeek) {
    for (const game of week.games) {
      const awayAbbrev = game.awayTeam.abbrev
      const homeAbbrev = game.homeTeam.abbrev

      if (
        (awayAbbrev === team1Abbrev && homeAbbrev === team2Abbrev) ||
        (awayAbbrev === team2Abbrev && homeAbbrev === team1Abbrev)
      ) {
        return game
      }
    }
  }
  return null
}

/**
 * Format player name from roster response
 */
export function formatPlayerName(player: Player): string {
  return `${player.firstName.default} ${player.lastName.default}`.trim()
}

