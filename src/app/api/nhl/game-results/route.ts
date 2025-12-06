import { NextResponse } from 'next/server'
import { getGameBoxscore, getGameLanding } from '@/lib/nhlApi'

/**
 * GET /api/nhl/game-results?gameId=2025020452
 * Gets actual game results (boxscore) for a completed game
 * Returns player stats, scores, and game details
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gameIdParam = searchParams.get('gameId')
    
    if (!gameIdParam) {
      return NextResponse.json(
        { error: 'gameId parameter is required' },
        { status: 400 }
      )
    }
    
    const gameId = parseInt(gameIdParam)
    if (isNaN(gameId)) {
      return NextResponse.json(
        { error: 'Invalid gameId' },
        { status: 400 }
      )
    }
    
    // Get boxscore and landing data
    const [boxscore, landing] = await Promise.all([
      getGameBoxscore(gameId),
      getGameLanding(gameId),
    ])
    
    // Extract player stats from boxscore
    // The structure will depend on NHL API response format
    // We'll need to parse it based on actual API structure
    
    return NextResponse.json({
      gameId,
      boxscore,
      landing,
      // We'll transform this data in the component that uses it
    })
  } catch (error) {
    console.error('Error fetching game results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch game results. Game may not be completed yet.' },
      { status: 500 }
    )
  }
}

