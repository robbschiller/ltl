import { NextResponse } from 'next/server'
import { getUpcomingRedWingsGame } from '@/lib/nhlGameSelection'

/**
 * GET /api/nhl/game?date=YYYY-MM-DD
 * Gets the next upcoming Red Wings game (defaults to tonight's game)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    const redWingsGame = await getUpcomingRedWingsGame(dateParam || undefined)
    
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

