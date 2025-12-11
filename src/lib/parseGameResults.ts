import type { GameResult, GamePlayerStats, Game, Player } from './types'

type TeamSide = 'homeTeam' | 'awayTeam'

interface NhlGoal {
  isShorthanded?: boolean
  isOTGoal?: boolean
  // other fields omitted
}

interface NhlAssist {
  isShorthanded?: boolean
  // other fields omitted
}

interface NhlPlayerGameStats {
  playerId: string | number
  sweaterNumber: number | string
  position: string
  goals?: NhlGoal[]
  assists?: NhlAssist[]
  // other fields are there; we only take what we need
}

interface RawBoxscore {
  homeTeam: { id: number; abbrev: string; score?: number }
  awayTeam: { id: number; abbrev: string; score?: number }
  playerByGameStats: Record<
    TeamSide,
    {
      forwards?: NhlPlayerGameStats[]
      defense?: NhlPlayerGameStats[]
      defencemen?: NhlPlayerGameStats[] // just in case older spelling
      goalies?: NhlPlayerGameStats[]
    }
  >
  periodDescriptor?: {
    periodType?: string
  }
}

export interface PlayerGameResult {
  playerId: string
  position: string
  goals: NhlGoal[]
  assists: NhlAssist[]
}

export interface ParsedGameResult {
  playerStats: PlayerGameResult[]
  redWingsScore: number
  opponentScore: number
  opponent: string
}

const RED_WINGS_ID = 17 // what you logged earlier

/**
 * Parse real NHL API boxscore data into our GameResult format
 * Enhanced to handle play-by-play data for shorthanded goals, OT goals, and empty net goals
 */
export function parseRealGameResults(
  apiData: {
    boxscore?: RawBoxscore
    landing?: unknown
    playByPlay?: unknown
    game?: unknown
  },
  game: Game,
  roster: Player[],
  playByPlay?: unknown,
): GameResult {
  const boxscore = apiData.boxscore
  const pbp = playByPlay || apiData.playByPlay
  const scheduleGame = apiData.game as {
    homeTeam?: { abbrev: string; id?: number; score?: number }
    awayTeam?: { abbrev: string; id?: number; score?: number }
    gameOutcome?: { lastPeriodType?: string }
  } | undefined
  
  // Extract team scores - prefer scores from schedule game, fallback to boxscore
  let redWingsScore = 0
  let opponentScore = 0
  let wentToOT = false
  let shootoutOccurred = false
  let emptyNetGoals = 0
  
  // First try to get scores from schedule game (most reliable)
  if (scheduleGame) {
    const isHome = scheduleGame.homeTeam?.abbrev === 'DET'
    const redWingsTeam = isHome ? scheduleGame.homeTeam : scheduleGame.awayTeam
    const opponentTeam = isHome ? scheduleGame.awayTeam : scheduleGame.homeTeam
    
    redWingsScore = redWingsTeam?.score ?? 0
    opponentScore = opponentTeam?.score ?? 0
    
    // Check game state for OT/shootout
    if (scheduleGame.gameOutcome?.lastPeriodType) {
      const periodType = scheduleGame.gameOutcome.lastPeriodType
      wentToOT = periodType === 'OT' || periodType === 'SO'
      shootoutOccurred = periodType === 'SO'
    }
  }
  
  // The boxscore root IS the boxscore - no nested boxscore.boxscore
  // Fallback to boxscore scores if not available from schedule game
  if (redWingsScore === 0 && opponentScore === 0 && boxscore) {
    const homeTeam = boxscore.homeTeam
    const awayTeam = boxscore.awayTeam
    
    const isHome = game.isHome
    redWingsScore = isHome ? (homeTeam?.score || 0) : (awayTeam?.score || 0)
    opponentScore = isHome ? (awayTeam?.score || 0) : (homeTeam?.score || 0)
    
    // Check for OT/shootout from boxscore
    if (boxscore.periodDescriptor) {
      const periodType = boxscore.periodDescriptor.periodType
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
    const pbpData = pbp as { plays?: unknown[]; playsAllPlays?: unknown[] }
    const plays = pbpData?.plays || pbpData?.playsAllPlays || []
    // Get Red Wings team ID from boxscore or schedule game
    let redWingsTeamId: number | undefined
    if (boxscore?.homeTeam) {
      redWingsTeamId = (boxscore.homeTeam.id === 17 || boxscore.homeTeam.abbrev === 'DET') 
        ? boxscore.homeTeam.id 
        : boxscore.awayTeam?.id
    } else if (scheduleGame) {
      const isHome = scheduleGame.homeTeam?.abbrev === 'DET'
      redWingsTeamId = isHome ? scheduleGame.homeTeam?.id : scheduleGame.awayTeam?.id
    } else {
      redWingsTeamId = game.isHome ? boxscore?.homeTeam?.id : boxscore?.awayTeam?.id
    }
    
    plays.forEach((playUnknown) => {
      const play = playUnknown as {
        typeDescKey?: string
        details?: {
          scoringPlayerId?: number
          assistPlayerIds?: number[]
          situationCode?: string
          emptyNet?: boolean
          emptyNetGoal?: boolean
        }
        teamId?: number
        periodDescriptor?: {
          number?: number
          periodType?: string
        }
        situationCode?: string
      }
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
  
  // Parse the boxscore structure
  console.log('[PARSE-GAME-RESULTS] Boxscore structure check:')
  console.log('- boxscore exists:', !!boxscore)
  console.log('- boxscore type:', typeof boxscore)
  console.log('- boxscore keys:', boxscore ? Object.keys(boxscore).slice(0, 20) : [])
  console.log('- playerByGameStats exists:', !!boxscore?.playerByGameStats)
  
  if (!boxscore?.playerByGameStats) {
    console.warn(
      '[PARSE-GAME-RESULTS] No playerByGameStats in boxscore',
      {
        boxscoreKeys: boxscore ? Object.keys(boxscore) : [],
        boxscoreType: typeof boxscore,
        hasBoxscore: !!boxscore,
        sampleBoxscoreValue: boxscore ? JSON.stringify(boxscore).substring(0, 500) : null,
      }
    )
    return {
      gameId: game.id,
      playerStats: [],
      teamPoints: 0,
      completedAt: new Date().toISOString(),
    }
  }
  
  console.log('[PARSE-GAME-RESULTS] playerByGameStats structure:', {
    hasHomeTeam: !!boxscore.playerByGameStats.homeTeam,
    hasAwayTeam: !!boxscore.playerByGameStats.awayTeam,
    homeTeamKeys: boxscore.playerByGameStats.homeTeam ? Object.keys(boxscore.playerByGameStats.homeTeam) : [],
    awayTeamKeys: boxscore.playerByGameStats.awayTeam ? Object.keys(boxscore.playerByGameStats.awayTeam) : [],
  })
  
  // Determine which team is Red Wings (home or away)
  const isHome =
    boxscore.homeTeam?.id === RED_WINGS_ID || boxscore.homeTeam?.abbrev === 'DET'
  const teamSide: TeamSide = isHome ? 'homeTeam' : 'awayTeam'
  
  const teamStatsRoot = boxscore.playerByGameStats?.[teamSide]
  
  if (!teamStatsRoot) {
    console.warn(
      '[PARSE-GAME-RESULTS] No playerByGameStats for',
      teamSide,
      {
        availableSides: Object.keys(boxscore.playerByGameStats || {}),
        homeTeamStructure: boxscore.playerByGameStats?.homeTeam ? Object.keys(boxscore.playerByGameStats.homeTeam) : [],
        awayTeamStructure: boxscore.playerByGameStats?.awayTeam ? Object.keys(boxscore.playerByGameStats.awayTeam) : [],
        isHome,
        teamSide,
      }
    )
    return {
      gameId: game.id,
      playerStats: [],
      teamPoints: 0,
      completedAt: new Date().toISOString(),
    }
  }
  
  // Flatten the skaters + goalies into one list
  const forwards = teamStatsRoot.forwards ?? []
  const defense = teamStatsRoot.defense ?? teamStatsRoot.defencemen ?? []
  const goalies = teamStatsRoot.goalies ?? []
  const allPlayers: NhlPlayerGameStats[] = [
    ...forwards,
    ...defense,
    ...goalies,
  ]
  
  console.log(
    '[PARSE-GAME-RESULTS] Found players from boxscore:',
    allPlayers.length
  )
  
  if (allPlayers.length === 0) {
    console.warn('[PARSE-GAME-RESULTS] No players found in boxscore')
    return {
      gameId: game.id,
      playerStats: [],
      teamPoints: 0,
      completedAt: new Date().toISOString(),
    }
  }
  
  // Map players to our format
  // The boxscore may have goals/assists as arrays or as counts
  // Log first player structure to understand the API format
  if (allPlayers.length > 0) {
    const firstPlayer = allPlayers[0] as NhlPlayerGameStats & {
      g?: number
      a?: number
      goalsFor?: number
      assistsFor?: number
      stats?: { goals?: number; assists?: number; g?: number; a?: number }
      [key: string]: unknown
    }
    console.log('[PARSE-GAME-RESULTS] Sample player structure:', {
      playerId: firstPlayer.playerId,
      playerKeys: Object.keys(firstPlayer),
      goals: firstPlayer.goals,
      assists: firstPlayer.assists,
      goalsType: typeof firstPlayer.goals,
      assistsType: typeof firstPlayer.assists,
      // Check common NHL API field names
      g: firstPlayer.g,
      a: firstPlayer.a,
      goalsFor: firstPlayer.goalsFor,
      assistsFor: firstPlayer.assistsFor,
      stats: firstPlayer.stats,
    })
  }
  
  allPlayers.forEach((p: NhlPlayerGameStats & {
    goals?: NhlGoal[] | number
    assists?: NhlAssist[] | number
    name?: { default: string }
    firstName?: { default: string }
    lastName?: { default: string }
    // Common NHL API field names
    g?: number
    a?: number
    goalsFor?: number
    assistsFor?: number
    stats?: {
      goals?: number
      assists?: number
      g?: number
      a?: number
    }
  }) => {
    const playerId = String(p.playerId)
    
    // Handle goals - check multiple possible field names
    let goalsCount = 0
    let goalsArray: NhlGoal[] = []
    
    // Try different field names for goals
    if (Array.isArray(p.goals)) {
      goalsArray = p.goals
      goalsCount = p.goals.length
    } else if (typeof p.goals === 'number') {
      goalsCount = p.goals
    } else if (typeof p.g === 'number') {
      goalsCount = p.g
    } else if (typeof p.goalsFor === 'number') {
      goalsCount = p.goalsFor
    } else if (p.stats && typeof p.stats.goals === 'number') {
      goalsCount = p.stats.goals
    } else if (p.stats && typeof p.stats.g === 'number') {
      goalsCount = p.stats.g
    }
    
    // Handle assists - check multiple possible field names
    let assistsCount = 0
    let assistsArray: NhlAssist[] = []
    
    // Try different field names for assists
    if (Array.isArray(p.assists)) {
      assistsArray = p.assists
      assistsCount = p.assists.length
    } else if (typeof p.assists === 'number') {
      assistsCount = p.assists
    } else if (typeof p.a === 'number') {
      assistsCount = p.a
    } else if (typeof p.assistsFor === 'number') {
      assistsCount = p.assistsFor
    } else if (p.stats && typeof p.stats.assists === 'number') {
      assistsCount = p.stats.assists
    } else if (p.stats && typeof p.stats.a === 'number') {
      assistsCount = p.stats.a
    }
    
    // Log if we found stats
    if (goalsCount > 0 || assistsCount > 0) {
      console.log(`[PARSE-GAME-RESULTS] Player ${playerId}: ${goalsCount} goals, ${assistsCount} assists`)
    }
    
    // Get goal details from play-by-play if available
    const pbpGoals = goalDetails.get(Number(p.playerId)) || []
    const pbpAssists = assistDetails.get(Number(p.playerId)) || []
    
    // Build goals array with play-by-play enhancement
    const goals: Array<{ isShorthanded: boolean; isOTGoal: boolean }> = []
    for (let i = 0; i < goalsCount; i++) {
      const pbpGoal = pbpGoals[i]
      const boxscoreGoal = goalsArray[i]
      
      if (pbpGoal) {
        goals.push({
          isShorthanded: pbpGoal.isShorthanded,
          isOTGoal: pbpGoal.isOTGoal,
        })
      } else if (boxscoreGoal) {
        goals.push({
          isShorthanded: boxscoreGoal.isShorthanded || false,
          isOTGoal: boxscoreGoal.isOTGoal || false,
        })
      } else {
        // Fallback: assume last goal is OT if game went to OT
        goals.push({
          isShorthanded: false,
          isOTGoal: wentToOT && i === goalsCount - 1,
        })
      }
    }
    
    // Build assists array with play-by-play enhancement
    const assists: Array<{ isShorthanded: boolean }> = []
    for (let i = 0; i < assistsCount; i++) {
      const pbpAssist = pbpAssists[i]
      const boxscoreAssist = assistsArray[i]
      
      if (pbpAssist) {
        assists.push({
          isShorthanded: pbpAssist.isShorthanded,
        })
      } else if (boxscoreAssist) {
        assists.push({
          isShorthanded: boxscoreAssist.isShorthanded || false,
        })
      } else {
        assists.push({
          isShorthanded: false,
        })
      }
    }
    
    // Match player to roster by ID
    const rosterPlayer = roster.find(rosterP => {
      const nhlId = (rosterP as Player & { playerId?: number }).playerId
      if (nhlId && String(nhlId) === playerId) return true
      if (rosterP.id === playerId) return true
      return false
    })
    
    if (rosterPlayer) {
      playerStats.push({
        playerId: rosterPlayer.id,
        goals,
        assists,
        position: rosterPlayer.position || p.position || 'F',
      })
    } else {
      // If no roster match, still include the player with their boxscore ID
      // This ensures we don't lose player stats
      playerStats.push({
        playerId: playerId,
        goals,
        assists,
        position: p.position || 'F',
      })
    }
  })
  
  // Ensure we have stats for all roster players (even if they didn't play)
  const existingPlayerIds = new Set(playerStats.map(s => s.playerId))
  
  roster.forEach((player) => {
    const playerWithNhlId = player as Player & { playerId?: number }
    const nhlId = String(playerWithNhlId.playerId || player.id)
    if (!existingPlayerIds.has(player.id) && !existingPlayerIds.has(nhlId)) {
      // Add empty stats for players not in the boxscore
      playerStats.push({
        playerId: player.id,
        goals: [],
        assists: [],
        position: player.position,
      })
    }
  })
  
  if (playerStats.length === 0) {
    const firstPlayer = allPlayers[0] as NhlPlayerGameStats & { name?: { default: string } }
    console.error('[PARSE] ERROR: No player stats created!', {
      playersFromBoxscore: allPlayers.length,
      rosterSize: roster.length,
      samplePlayerId: firstPlayer?.playerId,
      samplePlayerName: firstPlayer?.name?.default,
    })
  } else {
    console.log('[PARSE] Success: Created', playerStats.length, 'player stats from', allPlayers.length, 'boxscore players')
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

