// NHL API client for fetching games, rosters, and game events
// API Base: https://api-web.nhle.com (working endpoint)
// Fallback: https://statsapi.web.nhl.com (may have DNS issues)
// Detroit Red Wings Team ID: 17
// Set USE_MOCK_NHL_API=true in .env.local to use mock data for development

const NHL_API_BASE = 'https://api-web.nhle.com/v1'
const NHL_STATS_API_BASE = 'https://api.nhle.com/stats/rest/en'
const DETROIT_TEAM_ID = 17
const DETROIT_TEAM_ABBREV = 'det'
const USE_MOCK_API = process.env.USE_MOCK_NHL_API === 'true'

// Custom error types
export class NHLAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message)
    this.name = 'NHLAPIError'
  }
}

export class NHLNetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message)
    this.name = 'NHLNetworkError'
  }
}

export class NHLNotFoundError extends Error {
  constructor(message: string, public endpoint?: string) {
    super(message)
    this.name = 'NHLNotFoundError'
  }
}

// Helper to check if error is DNS-related
function isDNSError(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === 'ENOTFOUND' || 
         err?.code === 'EAI_AGAIN' ||
         (typeof err?.message === 'string' && (
           err.message.includes('getaddrinfo') ||
           err.message.includes('resolve host')
         ))
}

/**
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  retryDelay = 1000
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      if (response.ok) {
        return response
      }

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        if (response.status === 404) {
          throw new NHLNotFoundError(`Resource not found: ${url}`, url)
        }
        throw new NHLAPIError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
          url
        )
      }

      // Retry on 5xx errors (server errors) or network errors
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt)
        console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms: ${url}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        lastError = new NHLAPIError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
          url
        )
        continue
      }

      throw new NHLAPIError(
        `API error: ${response.status} ${response.statusText}`,
        response.status,
        url
      )
    } catch (error) {
      lastError = error

      // Don't retry on known errors
      if (error instanceof NHLNotFoundError || error instanceof NHLAPIError) {
        throw error
      }

      // Retry on network errors
      if (isDNSError(error) || (error instanceof Error && error.message.includes('fetch'))) {
        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt)
          console.warn(`Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms: ${url}`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new NHLNetworkError(`Network error: ${url}`, error)
      }

      throw error
    }
  }

  throw lastError
}

// ===== Season Helper Functions =====

/**
 * Get the current NHL season year (e.g., 2025 for 2025-26 season)
 * NHL season typically starts in October
 */
export function getCurrentSeasonYear(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12

  // If we're in October or later, we're in the season that started this year
  // If we're before October, we're in the season that started last year
  if (month >= 10) {
    return year
  } else {
    return year - 1
  }
}

/**
 * Get the current NHL season as a string (e.g., "20252026" for 2025-26 season)
 */
export function getCurrentSeason(): string {
  const startYear = getCurrentSeasonYear()
  const endYear = startYear + 1
  return `${startYear}${endYear}`
}

/**
 * Format season for API endpoints that expect a single year
 * Some endpoints use just the start year (e.g., "2025")
 */
export function getSeasonYear(season?: string): string {
  if (season) {
    // If season is already formatted as "2025", return it
    if (season.length === 4) {
      return season
    }
    // If season is "20252026", extract start year
    if (season.length === 8) {
      return season.substring(0, 4)
    }
  }
  return getCurrentSeasonYear().toString()
}

/**
 * Format season for API endpoints that expect full season format
 * Some endpoints use "20252026" format
 */
export function formatSeasonForAPI(season?: string): string {
  if (season) {
    // If already in correct format, return it
    if (season.length === 8) {
      return season
    }
    // If just year, convert to full format
    if (season.length === 4) {
      const startYear = parseInt(season)
      return `${startYear}${startYear + 1}`
    }
  }
  return getCurrentSeason()
}

export interface NHLScheduleGame {
  gamePk: number
  gameDate: string
  status: {
    abstractGameState: string
    detailedState: string
  }
  teams: {
    away: {
      team: {
        id: number
        name: string
      }
      score?: number
    }
    home: {
      team: {
        id: number
        name: string
      }
      score?: number
    }
  }
  venue?: {
    name: string
  }
}

export interface NHLScheduleResponse {
  dates: Array<{
    date: string
    games: NHLScheduleGame[]
  }>
}

export interface NHLRosterPlayer {
  person: {
    id: number
    fullName: string
  }
  jerseyNumber: string
  position: {
    code: string
    name: string
    type: string
  }
}

export interface NHLRosterResponse {
  roster: Array<{
    person: {
      id: number
      fullName: string
    }
    jerseyNumber: string
    position: {
      code: string
      name: string
      type: string
    }
  }>
}

export interface NHLGameEvent {
  result: {
    event: string
    description: string
    eventTypeId?: string
  }
  about: {
    periodTime: string
    period: number
    periodType?: string
    ordinalNum?: string
  }
  players?: Array<{
    player: {
      id: number
      fullName: string
    }
    playerType: string
  }>
  team?: {
    id: number
    name: string
  }
}

export interface NHLGameFeedResponse {
  gameData: {
    game: {
      pk: number
      gameDate: string
      gameType: string
    }
    teams: {
      away: {
        id: number
        name: string
      }
      home: {
        id: number
        name: string
      }
    }
    venue: {
      name: string
    }
  }
  liveData: {
    plays: {
      allPlays: NHLGameEvent[]
      scoringPlays: number[]
    }
    linescore: {
      currentPeriod: number
      currentPeriodOrdinal: string
      currentPeriodTimeRemaining: string
      teams: {
        away: {
          goals: number
        }
        home: {
          goals: number
        }
      }
      period?: Array<{
        periodType: string
        num: number
      }>
    }
  }
}

export interface NHLBoxscoreResponse {
  teams: {
    away: {
      team: {
        id: number
        name: string
      }
      teamStats: {
        teamSkaterStats: {
          goals: number
        }
      }
      players: {
        [key: string]: {
          person: {
            id: number
            fullName: string
          }
          jerseyNumber: string
          position: {
            code: string
            type: string
            abbreviation: string
          }
          stats: {
            skaterStats?: {
              goals: number
              assists: number
              plusMinus: number
              shots: number
              hits: number
              blockedShots: number
              powerPlayGoals: number
              shortHandedGoals: number
              shortHandedAssists: number
            }
            goalieStats?: {
              saves: number
              shotsAgainst: number
              goalsAgainst: number
              shutouts: number
            }
          }
        }
      }
    }
    home: {
      team: {
        id: number
        name: string
      }
      teamStats: {
        teamSkaterStats: {
          goals: number
        }
      }
      players: {
        [key: string]: {
          person: {
            id: number
            fullName: string
          }
          jerseyNumber: string
          position: {
            code: string
            type: string
            abbreviation: string
          }
          stats: {
            skaterStats?: {
              goals: number
              assists: number
              plusMinus: number
              shots: number
              hits: number
              blockedShots: number
              powerPlayGoals: number
              shortHandedGoals: number
              shortHandedAssists: number
            }
            goalieStats?: {
              saves: number
              shotsAgainst: number
              goalsAgainst: number
              shutouts: number
            }
          }
        }
      }
    }
  }
}

/**
 * Fetch schedule for Detroit Red Wings games
 */
export async function fetchRedWingsSchedule(
  startDate: string,
  endDate: string
): Promise<NHLScheduleGame[]> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    console.log('Using mock NHL API data')
    const { generateMockGames } = await import('./nhl-api-mock')
    const mockGames = generateMockGames()
    return mockGames as NHLScheduleGame[]
  }

  try {
    const url = `${NHL_API_BASE}/schedule?teamId=${DETROIT_TEAM_ID}&startDate=${startDate}&endDate=${endDate}`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`NHL API error: ${response.status} ${response.statusText}`)
    }

    const data: NHLScheduleResponse = await response.json()
    const games: NHLScheduleGame[] = []

    for (const date of data.dates) {
      games.push(...date.games)
    }

    return games
  } catch (error: unknown) {
    console.error('Error fetching Red Wings schedule:', error)
    if (isDNSError(error)) {
      // Fall back to mock data if DNS fails
      console.warn('DNS resolution failed, falling back to mock data')
      const { generateMockGames } = await import('./nhl-api-mock')
      const mockGames = generateMockGames()
      return mockGames as NHLScheduleGame[]
    }
    throw error
  }
}

/**
 * Fetch Detroit Red Wings roster
 */
export async function fetchRedWingsRoster(): Promise<NHLRosterPlayer[]> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    console.log('Using mock NHL API data for roster')
    const { generateMockRoster } = await import('./nhl-api-mock')
    return generateMockRoster() as NHLRosterPlayer[]
  }

  try {
    const url = `${NHL_API_BASE}/teams/${DETROIT_TEAM_ID}/roster`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`NHL API error: ${response.status} ${response.statusText}`)
    }

    const data: NHLRosterResponse = await response.json()
    return data.roster
  } catch (error: unknown) {
    console.error('Error fetching Red Wings roster:', error)
    if (isDNSError(error)) {
      // Fall back to mock data if DNS fails
      console.warn('DNS resolution failed, falling back to mock data')
      const { generateMockRoster } = await import('./nhl-api-mock')
      return generateMockRoster() as NHLRosterPlayer[]
    }
    throw error
  }
}

/**
 * Fetch game feed for live events and scoring
 */
export async function fetchGameFeed(gamePk: number): Promise<NHLGameFeedResponse> {
  try {
    const url = `${NHL_API_BASE}/game/${gamePk}/feed/live`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`NHL API error: ${response.status} ${response.statusText}`)
    }

    const data: NHLGameFeedResponse = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching game feed for game ${gamePk}:`, error)
    throw error
  }
}

/**
 * Fetch game boxscore for player statistics
 */
export async function fetchGameBoxscore(gamePk: number): Promise<NHLBoxscoreResponse> {
  try {
    const url = `${NHL_API_BASE}/game/${gamePk}/boxscore`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`NHL API error: ${response.status} ${response.statusText}`)
    }

    const data: NHLBoxscoreResponse = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching boxscore for game ${gamePk}:`, error)
    throw error
  }
}

/**
 * Convert NHL position code to our position format
 */
export function convertPosition(positionCode: string, positionType: string): string {
  // Position types: Forward, Defenseman, Goalie
  if (positionType === 'Goalie') {
    return 'Goalie'
  }
  if (positionType === 'Defenseman') {
    return 'Defense'
  }
  return 'Forward'
}

/**
 * Check if a game has gone to overtime
 */
export function isOvertimeGame(gameFeed: NHLGameFeedResponse): boolean {
  const periods = gameFeed.liveData.linescore.period || []
  return periods.some((period) => period.periodType === 'OVERTIME')
}

/**
 * Check if a goal was scored shorthanded
 */
export function isShorthandedGoal(event: NHLGameEvent): boolean {
  // Check if it's a goal event
  if (event.result.event !== 'Goal') {
    return false
  }

  // Check description for shorthanded indicators
  const description = event.result.description?.toLowerCase() || ''
  return (
    description.includes('shorthanded') ||
    description.includes('short-handed') ||
    description.includes('sh')
  )
}

/**
 * Check if a goal was an empty net goal (doesn't count against goalie)
 */
export function isEmptyNetGoal(event: NHLGameEvent): boolean {
  const description = event.result.description?.toLowerCase() || ''
  return description.includes('empty net')
}

/**
 * Format date for NHL API (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get date range for upcoming games (next 30 days)
 */
export function getUpcomingGamesDateRange(): { startDate: string; endDate: string } {
  const today = new Date()
  const endDate = new Date()
  endDate.setDate(today.getDate() + 30)

  return {
    startDate: formatDateForAPI(today),
    endDate: formatDateForAPI(endDate),
  }
}

/**
 * Get date range for past games (last 30 days)
 */
export function getPastGamesDateRange(): { startDate: string; endDate: string } {
  const today = new Date()
  const startDate = new Date()
  startDate.setDate(today.getDate() - 30)

  return {
    startDate: formatDateForAPI(startDate),
    endDate: formatDateForAPI(today),
  }
}

// ===== New API (api-web.nhle.com) Interfaces =====

export interface NHLWebGame {
  id: number
  season: number
  gameType: number
  venue: {
    default: string
  }
  startTimeUTC: string
  gameState: string // 'OFF', 'FUT', 'LIVE', etc.
  gameScheduleState: string // 'OK', 'CANCELED', etc.
  awayTeam: {
    id: number
    commonName: { default: string }
    placeName: { default: string }
    abbrev: string
    score?: number
  }
  homeTeam: {
    id: number
    commonName: { default: string }
    placeName: { default: string }
    abbrev: string
    score?: number
  }
  periodDescriptor?: {
    number: number
    periodType: string
    maxRegulationPeriods: number
  }
  gameOutcome?: {
    lastPeriodType: string
  }
}

export interface NHLWebScheduleResponse {
  gameWeek: Array<{
    date: string
    dayAbbrev: string
    numberOfGames: number
    games: NHLWebGame[]
  }>
  nextStartDate?: string
  previousStartDate?: string
}

export interface NHLWebRosterPlayer {
  id: number
  firstName: { default: string }
  lastName: { default: string }
  sweaterNumber: number
  position: string
  shootsCatches: string
  heightInInches: number
  weightInPounds: number
}

export interface NHLWebRosterResponse {
  forwards: NHLWebRosterPlayer[]
  defensemen: NHLWebRosterPlayer[] // API uses "defensemen" not "defense"
  goalies: NHLWebRosterPlayer[]
}

export interface NHLWebGameDetailsResponse {
  id: number
  season: number
  gameType: number
  gameState: string
  venue: { default: string }
  startTimeUTC: string
  awayTeam: {
    id: number
    commonName: { default: string }
    abbrev: string
    score: number
    sog: number // Shots on goal
  }
  homeTeam: {
    id: number
    commonName: { default: string }
    abbrev: string
    score: number
    sog: number
  }
  boxscore?: {
    teamGameStats: Array<{
      teamId: number
      gameStats: {
        goals: number
        pim: number // Penalty minutes
        shots: number
        powerPlayPercentage: string
        powerPlayGoals: number
        powerPlayOpportunities: number
        faceOffWinPercentage: string
        blockedShots: number
        takeaways: number
        giveaways: number
        hits: number
      }
    }>
    playerStats: Array<{
      playerId: number
      sweaterNumber: number
      name: { default: string }
      position: string
      goals: number
      assists: number
      points: number
      plusMinus: number
      pim: number
      hits: number
      blockedShots: number
      timeOnIce: string
      powerPlayGoals: number
      shortHandedGoals: number
      shots: number
    }>
  }
}

// Player Stats Interfaces
export interface NHLPlayerStatsSummary {
  playerId: number
  name: { default: string }
  sweaterNumber: number
  position: string
  teamId: number
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  plusMinus: number
  pim: number
  shots: number
  powerPlayGoals: number
  shortHandedGoals: number
  gameWinningGoals: number
  timeOnIce: string
  faceoffWinPctg?: number
}

export interface NHLGoalieStatsSummary {
  playerId: number
  name: { default: string }
  sweaterNumber: number
  teamId: number
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  shutouts: number
  saves: number
  shotsAgainst: number
  goalsAgainst: number
  savePctg: number
  goalsAgainstAverage: number
  timeOnIce: string
}

export interface NHLStatsAPIResponse<T> {
  data: T[]
}

// ===== New API Functions (api-web.nhle.com) =====

/**
 * Fetch schedule for a specific date using the working api-web.nhle.com endpoint
 * @param date YYYY-MM-DD format
 */
export async function fetchScheduleByDate(date: string): Promise<NHLWebGame[]> {
  try {
    const url = `${NHL_API_BASE}/schedule/${date}`
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLWebScheduleResponse = await response.json()
    const games: NHLWebGame[] = []

    for (const week of data.gameWeek) {
      games.push(...week.games)
    }

    console.log(`✅ Fetched ${games.length} games for date ${date}`)
    return games
  } catch (error) {
    console.error(`Error fetching schedule for date ${date}:`, error)
    throw error
  }
}

/**
 * Fetch 2025-26 Red Wings schedule by fetching games for date range
 * Returns all games where Detroit (ID 17) is playing
 */
export async function fetchRedWings202526Schedule(): Promise<NHLWebGame[]> {
  try {
    const allGames: NHLWebGame[] = []
    
    // Fetch schedule for each date from Oct 2025 through Apr 2026
    const startDate = new Date('2025-10-01')
    const endDate = new Date('2026-04-30')
    const currentDate = new Date(startDate)
    
    // Fetch up to 30 days at a time to avoid too many requests
    while (currentDate <= endDate) {
      const dateStr = formatDateForAPI(currentDate)
      try {
        const games = await fetchScheduleByDate(dateStr)
        
        // Filter for Detroit Red Wings games (ID 17)
        const redWingsGames = games.filter(
          (game) => game.awayTeam.id === DETROIT_TEAM_ID || game.homeTeam.id === DETROIT_TEAM_ID
        )
        
        allGames.push(...redWingsGames)
        
        // Move to next week (7 days ahead)
        currentDate.setDate(currentDate.getDate() + 7)
      } catch (error) {
        console.warn(`Failed to fetch games for ${dateStr}:`, error)
        // Continue with next date even if one fails
        currentDate.setDate(currentDate.getDate() + 7)
      }
    }

    // Sort by date
    allGames.sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime())

    return allGames
  } catch (error) {
    console.error('Error fetching 2025-26 Red Wings schedule:', error)
    throw error
  }
}

/**
 * Fetch Detroit Red Wings roster for a specific season
 * Uses documented endpoint: /roster/{teamAbbrev}/{season}
 * @param season Optional season (e.g., "20252026" or "current"). Defaults to "current".
 */
export async function fetchRedWingsRoster202526(season?: string): Promise<NHLWebRosterPlayer[]> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    console.log('Using mock NHL API data for roster')
    const { generateMockRoster } = await import('./nhl-api-mock')
    // Mock data returns different format, convert if needed
    return generateMockRoster() as unknown as NHLWebRosterPlayer[]
  }

  try {
    // Use "current" if no season specified, otherwise format the season
    const seasonParam = season === 'current' ? 'current' : (season ? formatSeasonForAPI(season) : 'current')
    const url = `${NHL_API_BASE}/roster/${DETROIT_TEAM_ABBREV}/${seasonParam}`
    
    console.log(`Fetching roster from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLWebRosterResponse = await response.json()
    
    // Combine all positions with proper position mapping
    // Note: API returns "defensemen" not "defense"
    const players: NHLWebRosterPlayer[] = [
      ...(data.forwards || []).map(p => ({ ...p, position: 'Forward' })),
      ...(data.defensemen || []).map(p => ({ ...p, position: 'Defense' })),
      ...(data.goalies || []).map(p => ({ ...p, position: 'Goalie' })),
    ]

    console.log(`✅ Fetched ${players.length} players from roster (${data.forwards?.length || 0} forwards, ${data.defensemen?.length || 0} defense, ${data.goalies?.length || 0} goalies)`)
    
    return players
  } catch (error) {
    console.error('Error fetching Red Wings roster:', error)
    
    if (isDNSError(error)) {
      console.warn('DNS resolution failed, falling back to mock data')
      const { generateMockRoster } = await import('./nhl-api-mock')
      // Mock data returns different format, convert if needed
      return generateMockRoster() as unknown as NHLWebRosterPlayer[]
    }
    
    throw error
  }
}

/**
 * Fetch game details and live stats for a specific game
 * Uses documented endpoint: /gamecenter/{gameId}/boxscore
 */
export async function fetchGameDetails(gameId: number): Promise<NHLWebGameDetailsResponse> {
  try {
    const url = `${NHL_API_BASE}/gamecenter/${gameId}/boxscore`
    
    console.log(`Fetching game details from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLWebGameDetailsResponse = await response.json()
    console.log(`✅ Fetched game details for game ${gameId}`)
    return data
  } catch (error) {
    console.error(`Error fetching game details for game ${gameId}:`, error)
    
    if (error instanceof NHLNotFoundError) {
      throw new NHLNotFoundError(`Game ${gameId} not found`, error.endpoint)
    }
    
    throw error
  }
}

/**
 * Fetch game boxscore for live games
 * Uses documented endpoint: /gamecenter/{gameId}/boxscore
 * This is an alias for fetchGameDetails for consistency
 */
export async function fetchGameBoxscoreNewAPI(gameId: number): Promise<NHLWebGameDetailsResponse> {
  return fetchGameDetails(gameId)
}

// ===== Player Stats Functions =====

/**
 * Fetch player stats for a specific season using the stats API
 * Uses documented endpoint: /skater/summary
 * @param season Optional season (e.g., "20252026"). Defaults to current season.
 * @param teamId Optional team ID to filter by team. Defaults to Detroit (17).
 */
export async function fetchPlayerStats(
  season?: string,
  teamId?: number
): Promise<NHLPlayerStatsSummary[]> {
  try {
    const seasonParam = formatSeasonForAPI(season)
    const teamFilter = teamId ? ` and teamId=${teamId}` : ''
    const cayenneExp = encodeURIComponent(`seasonId=${seasonParam}${teamFilter}`)
    
    const url = `${NHL_STATS_API_BASE}/skater/summary?cayenneExp=${cayenneExp}&limit=-1`
    
    console.log(`Fetching player stats from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLStatsAPIResponse<NHLPlayerStatsSummary> = await response.json()
    console.log(`✅ Fetched ${data.data.length} player stats`)
    return data.data
  } catch (error) {
    console.error('Error fetching player stats:', error)
    throw error
  }
}

/**
 * Fetch goalie stats for a specific season using the stats API
 * Uses documented endpoint: /goalie/summary
 * @param season Optional season (e.g., "20252026"). Defaults to current season.
 * @param teamId Optional team ID to filter by team. Defaults to Detroit (17).
 */
export async function fetchGoalieStats(
  season?: string,
  teamId?: number
): Promise<NHLGoalieStatsSummary[]> {
  try {
    const seasonParam = formatSeasonForAPI(season)
    const teamFilter = teamId ? ` and teamId=${teamId}` : ''
    const cayenneExp = encodeURIComponent(`seasonId=${seasonParam}${teamFilter}`)
    
    const url = `${NHL_STATS_API_BASE}/goalie/summary?cayenneExp=${cayenneExp}&limit=-1`
    
    console.log(`Fetching goalie stats from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLStatsAPIResponse<NHLGoalieStatsSummary> = await response.json()
    console.log(`✅ Fetched ${data.data.length} goalie stats`)
    return data.data
  } catch (error) {
    console.error('Error fetching goalie stats:', error)
    throw error
  }
}

/**
 * Fetch player stats for a specific game
 * Uses game boxscore which includes player stats
 * @param gameId Game ID
 */
export async function fetchPlayerStatsForGame(
  gameId: number
): Promise<NHLWebGameDetailsResponse['boxscore'] extends { playerStats: infer T } ? T : never[]> {
  try {
    const gameDetails = await fetchGameDetails(gameId)
    if (!gameDetails.boxscore || !('playerStats' in gameDetails.boxscore)) {
      return [] as NHLWebGameDetailsResponse['boxscore'] extends { playerStats: infer T } ? T : never[]
    }
    return gameDetails.boxscore.playerStats as NHLWebGameDetailsResponse['boxscore'] extends { playerStats: infer T } ? T : never[]
  } catch (error) {
    console.error(`Error fetching player stats for game ${gameId}:`, error)
    throw error
  }
}

// ===== Standings API Functions =====

export interface NHLStandingsTeam {
  teamId: number
  teamName: { default: string }
  teamAbbrev: { default: string }
  conferenceName: { default: string }
  divisionName: { default: string }
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  points: number
  pointsPercentage: number
  goalsFor: number
  goalsAgainst: number
  goalDifferential: number
  streakCode: string
  streakCount: number
}

export interface NHLStandingsResponse {
  standings: NHLStandingsTeam[]
}

/**
 * Fetch current standings
 * Uses documented endpoint: /standings/now
 */
export async function fetchStandings(): Promise<NHLStandingsTeam[]> {
  try {
    const url = `${NHL_API_BASE}/standings/now`
    
    console.log(`Fetching standings from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLStandingsResponse = await response.json()
    console.log(`✅ Fetched standings for ${data.standings.length} teams`)
    return data.standings
  } catch (error) {
    console.error('Error fetching standings:', error)
    throw error
  }
}

/**
 * Fetch standings for a specific season
 * Uses documented endpoint: /standings/{season}
 * @param season Optional season (e.g., "20252026"). Defaults to current season.
 */
export async function fetchStandingsForSeason(season?: string): Promise<NHLStandingsTeam[]> {
  try {
    const seasonParam = formatSeasonForAPI(season)
    const url = `${NHL_API_BASE}/standings/${seasonParam}`
    
    console.log(`Fetching standings from: ${url}`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data: NHLStandingsResponse = await response.json()
    console.log(`✅ Fetched standings for ${data.standings.length} teams`)
    return data.standings
  } catch (error) {
    console.error('Error fetching standings:', error)
    throw error
  }
}

/**
 * Get Detroit Red Wings games from a schedule response
 */
export function filterRedWingsGames(games: NHLWebGame[]): NHLWebGame[] {
  return games.filter(
    (game) => game.awayTeam.id === DETROIT_TEAM_ID || game.homeTeam.id === DETROIT_TEAM_ID
  )
}

/**
 * Convert NHLWebGame to our database Game format
 */
export function convertNHLWebGameToGame(nhlGame: NHLWebGame) {
  const isHome = nhlGame.homeTeam.id === DETROIT_TEAM_ID
  const opponentTeam = isHome ? nhlGame.awayTeam : nhlGame.homeTeam
  
  // Use commonName for opponent (e.g., "Avalanche", "Golden Knights")
  // Fallback to placeName if commonName not available
  const opponent = opponentTeam.commonName?.default || opponentTeam.placeName?.default || 'Unknown Team'
  
  // Full team name for awayTeam field (e.g., "Colorado Avalanche", "Vegas Golden Knights")
  const fullOpponentName = opponentTeam.placeName?.default && opponentTeam.commonName?.default
    ? `${opponentTeam.placeName.default} ${opponentTeam.commonName.default}`
    : opponent

  let status = 'scheduled'
  if (nhlGame.gameState === 'OFF' || nhlGame.gameState === 'OFFICIAL') {
    status = 'final'
  } else if (nhlGame.gameState === 'LIVE') {
    status = 'in_progress'
  }

  return {
    homeTeam: 'Detroit Red Wings',
    awayTeam: isHome ? fullOpponentName : 'Detroit Red Wings',
    gameDate: new Date(nhlGame.startTimeUTC),
    opponent: opponent, // Use short name for opponent field (e.g., "Avalanche", "Golden Knights")
    isHome: isHome,
    status: status,
    homeScore: nhlGame.homeTeam.score || null,
    awayScore: nhlGame.awayTeam.score || null,
  }
}

