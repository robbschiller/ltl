import { NextResponse } from 'next/server'
import { getRedWingsSeasonSchedule, nhlFetch } from '@/lib/nhlApi'

const NHL_WEB_BASE = 'https://api-web.nhle.com/v1'

/**
 * GET /api/nhl/last-game
 * Gets the most recent completed Red Wings game this season
 */
export async function GET() {
  try {
    // Try to get recent completed games from the score endpoint
    // Check today and the last 7 days for completed Red Wings games
    const now = new Date()
    const datesToCheck: string[] = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      datesToCheck.push(date.toISOString().split('T')[0]) // YYYY-MM-DD format
    }

    console.log('=== Checking score endpoints for Red Wings games ===')
    console.log('Dates to check:', datesToCheck)

    let lastRedWingsGame: any = null
    let lastGameDate: string | null = null

    // Check each date, starting with most recent
    for (const date of datesToCheck) {
      try {
        const scoreData = await nhlFetch<any>(`${NHL_WEB_BASE}/score/${date}`)
        console.log(`Checking date ${date}:`, scoreData.games?.length || 0, 'games')
        
        if (scoreData.games && Array.isArray(scoreData.games)) {
          // Find Red Wings games that are completed (gameState: "OFF")
          const redWingsGames = scoreData.games.filter((game: any) => {
            const isRedWings = game.awayTeam?.abbrev === 'DET' || game.homeTeam?.abbrev === 'DET'
            const isCompleted = game.gameState === 'OFF'
            return isRedWings && isCompleted
          })

          if (redWingsGames.length > 0) {
            // Get the most recent game (should be the last one in the array for that date)
            const game = redWingsGames[redWingsGames.length - 1]
            console.log(`Found Red Wings game on ${date}:`, {
              id: game.id,
              opponent: game.awayTeam?.abbrev === 'DET' ? game.homeTeam?.abbrev : game.awayTeam?.abbrev,
              redWingsScore: game.awayTeam?.abbrev === 'DET' ? game.awayTeam?.score : game.homeTeam?.score,
              opponentScore: game.awayTeam?.abbrev === 'DET' ? game.homeTeam?.score : game.awayTeam?.score,
            })
            lastRedWingsGame = game
            lastGameDate = date
            break // Found a game, stop checking older dates
          }
        }
      } catch (error) {
        console.log(`Error checking date ${date}:`, error)
        continue
      }
    }

    // Fallback to season schedule if score endpoint didn't find anything
    if (!lastRedWingsGame) {
      console.log('=== No games found in score endpoint, trying season schedule ===')
      
      // Get current season
      const currentYear = now.getFullYear()
      const month = now.getMonth() // 0-11, where 9 = October
      const seasonStartYear = month >= 9 ? currentYear : currentYear - 1
      const seasonEndYear = seasonStartYear + 1
      const season = `${seasonStartYear}${seasonEndYear}`

      console.log('Calculated season:', season)

      // Get all Red Wings games for the season
      const scheduleGames = await getRedWingsSeasonSchedule(season)

      console.log('=== LAST GAME API: Schedule Data ===')
      console.log('Season:', season)
      console.log('Total games found:', scheduleGames.length)
      if (scheduleGames.length > 0) {
        console.log('First game:', {
          id: scheduleGames[0].id,
          gameState: scheduleGames[0].gameState,
          date: scheduleGames[0].startTimeUTC,
          home: scheduleGames[0].homeTeam?.abbrev,
          away: scheduleGames[0].awayTeam?.abbrev,
        })
        console.log('Last game:', {
          id: scheduleGames[scheduleGames.length - 1].id,
          gameState: scheduleGames[scheduleGames.length - 1].gameState,
          date: scheduleGames[scheduleGames.length - 1].startTimeUTC,
          home: scheduleGames[scheduleGames.length - 1].homeTeam?.abbrev,
          away: scheduleGames[scheduleGames.length - 1].awayTeam?.abbrev,
        })
        // Log all unique game states
        const gameStates = [...new Set(scheduleGames.map(g => g.gameState))]
        console.log('All game states found:', gameStates)
      }

      // Filter for completed games
      const scheduleCompletedGames = scheduleGames.filter((game) => {
        const state = game.gameState
        return state === 'OFF' || 
               state === 'FINAL' || 
               state === 'OFFICIAL' ||
               (state !== 'FUT' && state !== 'LIVE' && state !== 'PRE' && game.homeTeam?.score !== undefined)
      })

      console.log('Completed games count:', scheduleCompletedGames.length)
      if (scheduleCompletedGames.length > 0) {
        lastRedWingsGame = scheduleCompletedGames[scheduleCompletedGames.length - 1]
        console.log('Found game from schedule:', lastRedWingsGame.id)
      }
    }

    if (!lastRedWingsGame) {
      return NextResponse.json(
        { error: 'No completed games found' },
        { status: 404 }
      )
    }

    const lastGame = lastRedWingsGame

    console.log('=== LAST GAME API DEBUG ===')
    console.log('Last game ID:', lastGame.id)
    console.log('Last game state:', lastGame.gameState)
    console.log('Last game date:', lastGame.gameDate || lastGame.startTimeUTC)
    console.log('Home team:', lastGame.homeTeam?.abbrev, 'Score:', lastGame.homeTeam?.score)
    console.log('Away team:', lastGame.awayTeam?.abbrev, 'Score:', lastGame.awayTeam?.score)
    console.log('Goals array length:', lastGame.goals?.length || 0)

    // Get scores from the game
    const redWingsScore = lastGame.homeTeam?.abbrev === 'DET' 
      ? (lastGame.homeTeam?.score || 0)
      : (lastGame.awayTeam?.score || 0)
    const opponentScore = lastGame.homeTeam?.abbrev === 'DET'
      ? (lastGame.awayTeam?.score || 0)
      : (lastGame.homeTeam?.score || 0)
    
    console.log('Red Wings score:', redWingsScore)
    console.log('Opponent score:', opponentScore)

    // Check for OT/shootout
    const wentToOT = lastGame.gameOutcome?.lastPeriodType === 'OT' || 
                     lastGame.gameOutcome?.lastPeriodType === 'SO' ||
                     lastGame.periodDescriptor?.periodType === 'OT' ||
                     lastGame.periodDescriptor?.periodType === 'SO'
    const shootoutOccurred = lastGame.gameOutcome?.lastPeriodType === 'SO' ||
                             lastGame.periodDescriptor?.periodType === 'SO'

    const isHome = lastGame.homeTeam?.abbrev === 'DET'
    const opponent = isHome ? lastGame.awayTeam : lastGame.homeTeam

    return NextResponse.json({
      gameId: lastGame.id,
      date: lastGame.startTimeUTC || lastGame.gameDate,
      opponent: opponent?.placeName?.default + ' ' + opponent?.commonName?.default || opponent?.name?.default || 'Unknown',
      opponentAbbrev: opponent?.abbrev,
      opponentLogo: opponent?.logo,
      redWingsScore,
      opponentScore,
      wentToOT,
      shootoutOccurred,
      isHome,
      game: lastGame, // Full game object for reference
      goals: lastGame.goals || [], // Include goals array for detailed stats
    })
  } catch (error) {
    console.error('Error fetching last completed game:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last completed game' },
      { status: 500 }
    )
  }
}
