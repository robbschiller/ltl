import { NextRequest, NextResponse } from 'next/server'
import { getGameBoxscore, getGameLanding, getGamePlayByPlay } from '@/lib/nhlApi'
import { parseRealGameResults } from '@/lib/parseGameResults'
import type { Game } from '@/lib/types'

/**
 * GET /api/nhl/historical-stats?gameId=2025020452
 * Gets historical game stats (boxscore, landing, play-by-play) for a completed game
 * Returns structured data matching our GameResult format
 */
export async function GET(request: NextRequest) {
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
    
    // Get boxscore, landing, and play-by-play data
    console.log('=== HISTORICAL STATS API DEBUG ===')
    console.log('Fetching stats for gameId:', gameId)
    
    const [boxscore, landing, playByPlay] = await Promise.all([
      getGameBoxscore(gameId),
      getGameLanding(gameId),
      getGamePlayByPlay(gameId).catch(() => null), // Play-by-play is optional
    ])
    
    console.log('Boxscore keys:', Object.keys(boxscore || {}))
    console.log('Landing keys:', Object.keys(landing || {}))
    console.log('PlayByPlay keys:', playByPlay ? Object.keys(playByPlay) : 'null')
    
    // Log boxscore structure
    if (boxscore) {
      console.log('Boxscore structure:', JSON.stringify(boxscore, null, 2).substring(0, 1000))
    }
    
    // Log landing structure
    if (landing) {
      console.log('Landing structure:', JSON.stringify(landing, null, 2).substring(0, 1000))
    }
    
    // Create a minimal Game object for parsing
    // We'll need to determine if Red Wings were home or away
    const boxscoreData = (boxscore as any)?.boxscore || boxscore
    const homeTeam = boxscoreData?.homeTeam
    const awayTeam = boxscoreData?.awayTeam
    const isHome = homeTeam?.abbrev === 'DET' || homeTeam?.commonName?.default?.includes('Red Wings')
    
    const game: Game = {
      id: String(gameId),
      opponent: isHome 
        ? (awayTeam?.placeName?.default || '') + ' ' + (awayTeam?.commonName?.default || '')
        : (homeTeam?.placeName?.default || '') + ' ' + (homeTeam?.commonName?.default || ''),
      opponentLogo: isHome ? awayTeam?.logo : homeTeam?.logo,
      date: '',
      time: '',
      venue: '',
      isHome,
      status: 'completed',
      teamGoals: isHome ? (homeTeam?.score || 0) : (awayTeam?.score || 0),
      opponentGoals: isHome ? (awayTeam?.score || 0) : (homeTeam?.score || 0),
      wentToOT: false,
      emptyNetGoals: 0,
      shootoutOccurred: false,
    }
    
    // Return raw data - parsing will happen in the adapter
    return NextResponse.json({
      gameId,
      boxscore,
      landing,
      playByPlay,
      game,
    })
  } catch (error) {
    console.error('Error fetching historical game stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch historical game stats' },
      { status: 500 }
    )
  }
}

