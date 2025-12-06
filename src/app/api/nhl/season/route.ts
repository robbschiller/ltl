import { NextResponse } from 'next/server'
import { getRedWingsSeasonSchedule } from '@/lib/nhlApi'

/**
 * GET /api/nhl/season?season=20252026&gameNumber=1
 * Gets Red Wings season schedule and optionally a specific game by number
 * 
 * Query params:
 * - season: Season format (e.g., "20252026") - defaults to current season
 * - gameNumber: Game number in sequence (1 = first game) - optional
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonParam = searchParams.get('season')
    const gameNumberParam = searchParams.get('gameNumber')
    
    // Calculate current season if not provided
    let season = seasonParam
    if (!season) {
      const now = new Date()
      const currentYear = now.getFullYear()
      const month = now.getMonth() // 0-11, where 9 = October
      const seasonStartYear = month >= 9 ? currentYear : currentYear - 1
      const seasonEndYear = seasonStartYear + 1
      season = `${seasonStartYear}${seasonEndYear}`
    }
    
    // Get all games for the season
    const games = await getRedWingsSeasonSchedule(season)
    
    if (games.length === 0) {
      return NextResponse.json(
        { error: 'No games found for this season' },
        { status: 404 }
      )
    }
    
    // If gameNumber is specified, return that specific game
    if (gameNumberParam) {
      const gameIndex = parseInt(gameNumberParam) - 1 // Convert to 0-based index
      if (gameIndex < 0 || gameIndex >= games.length) {
        return NextResponse.json(
          { error: `Game number ${gameNumberParam} not found. Season has ${games.length} games.` },
          { status: 404 }
        )
      }
      
      const game = games[gameIndex]
      return NextResponse.json({
        season,
        totalGames: games.length,
        gameNumber: parseInt(gameNumberParam),
        game: transformGameData(game),
      })
    }
    
    // Return all games
    return NextResponse.json({
      season,
      totalGames: games.length,
      games: games.map(transformGameData),
    })
  } catch (error) {
    console.error('Error fetching season schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch season schedule' },
      { status: 500 }
    )
  }
}

function transformGameData(game: any) {
  const isHome = game.homeTeam.abbrev === 'DET'
  const opponent = isHome ? game.awayTeam : game.homeTeam
  const redWings = isHome ? game.homeTeam : game.awayTeam
  
  const gameDate = new Date(game.startTimeUTC)
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
  
  return {
    id: String(game.id),
    gameId: game.id,
    opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
    opponentAbbrev: opponent.abbrev,
    opponentLogo: opponent.logo,
    opponentId: opponent.id,
    date: dateStr,
    time: timeStr,
    startTimeUTC: game.startTimeUTC,
    venue: game.venue.default,
    isHome,
    status: game.gameState === 'FUT' ? 'upcoming' : 'completed',
    gameState: game.gameState,
    season: game.season,
    gameType: game.gameType,
    nhlGameData: game,
  }
}

