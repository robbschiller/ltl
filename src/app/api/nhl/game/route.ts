import { NextResponse } from 'next/server'
import { getScheduleForDate, getTodaySchedule, type Game } from '@/lib/nhlApi'

/**
 * GET /api/nhl/game?date=YYYY-MM-DD
 * Gets the next upcoming Red Wings game (defaults to tonight's game)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    let redWingsGame: Game | null = null
    
    if (dateParam) {
      // If a specific date is requested, use that
      const schedule = await getScheduleForDate(dateParam)
      redWingsGame = schedule.gameWeek
        .flatMap(week => week.games)
        .find(game => {
          const awayAbbrev = game.awayTeam.abbrev
          const homeAbbrev = game.homeTeam.abbrev
          return awayAbbrev === 'DET' || homeAbbrev === 'DET'
        }) || null
    } else {
      // Default: find the next upcoming Red Wings game
      // First try today's schedule (includes games happening now/soon)
      const todaySchedule = await getTodaySchedule()
      
      // Get all Red Wings games from today's schedule
      const allRedWingsGames = todaySchedule.gameWeek
        .flatMap(week => week.games)
        .filter(game => {
          const awayAbbrev = game.awayTeam.abbrev
          const homeAbbrev = game.homeTeam.abbrev
          return awayAbbrev === 'DET' || homeAbbrev === 'DET'
        })
      
      console.log(`[GAME API] Found ${allRedWingsGames.length} Red Wings games today`)
      allRedWingsGames.forEach(game => {
        console.log(`[GAME API] Game ${game.id}: ${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}, state: ${game.gameState}, time: ${game.startTimeUTC}`)
      })
      
      // Filter for upcoming games (FUT = future, PRE = pre-game)
      const upcomingGames = allRedWingsGames.filter(game => 
        game.gameState === 'FUT' || game.gameState === 'PRE'
      )
      
      console.log(`[GAME API] Found ${upcomingGames.length} upcoming games`)
      
      if (upcomingGames.length > 0) {
        // Sort by start time and pick the next one
        upcomingGames.sort((a, b) => 
          new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
        )
        redWingsGame = upcomingGames[0]
        console.log(`[GAME API] Selected upcoming game: ${redWingsGame.id} (${redWingsGame.awayTeam.abbrev} @ ${redWingsGame.homeTeam.abbrev})`)
      } else {
        // No upcoming games today, check tomorrow
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        
        const tomorrowSchedule = await getScheduleForDate(tomorrowStr)
        const tomorrowGames = tomorrowSchedule.gameWeek
          .flatMap(week => week.games)
          .filter(game => {
            const awayAbbrev = game.awayTeam.abbrev
            const homeAbbrev = game.homeTeam.abbrev
            return awayAbbrev === 'DET' || homeAbbrev === 'DET'
          })
          .filter(game => game.gameState === 'FUT' || game.gameState === 'PRE')
        
        if (tomorrowGames.length > 0) {
          tomorrowGames.sort((a, b) => 
            new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
          )
          redWingsGame = tomorrowGames[0]
        } else {
          // Fallback: just get the first Red Wings game from today (even if completed)
          redWingsGame = allRedWingsGames[0] || null
        }
      }
    }
    
    if (!redWingsGame) {
      return NextResponse.json(
        { error: 'No Red Wings game found' },
        { status: 404 }
      )
    }
    
    // Transform to our format
    const isHome = redWingsGame.homeTeam.abbrev === 'DET'
    const opponent = isHome ? redWingsGame.awayTeam : redWingsGame.homeTeam
    
    // Format game date/time
    const gameDate = new Date(redWingsGame.startTimeUTC)
    const dateStr = gameDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const timeStr = gameDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZoneName: 'short'
    })
    
    const gameData = {
      id: String(redWingsGame.id),
      gameId: redWingsGame.id,
      opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
      opponentAbbrev: opponent.abbrev,
      opponentLogo: opponent.logo,
      opponentId: opponent.id,
      date: dateStr,
      time: timeStr,
      startTimeUTC: redWingsGame.startTimeUTC,
      venue: redWingsGame.venue.default,
      isHome,
      status: (redWingsGame.gameState === 'FUT' || redWingsGame.gameState === 'PRE') ? 'upcoming' : 'completed',
      gameState: redWingsGame.gameState,
      // Store full NHL API game data for reference
      nhlGameData: redWingsGame,
    }
    
    return NextResponse.json(gameData)
  } catch (error) {
    console.error('Error fetching NHL game:', error)
    return NextResponse.json(
      { error: 'Failed to fetch game data' },
      { status: 500 }
    )
  }
}

