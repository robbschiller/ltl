import { NextResponse } from 'next/server'
import { getTeamRosterCurrent, formatPlayerName, getTeamPlayerStats, type Player } from '@/lib/nhlApi'

/**
 * GET /api/nhl/roster?team=DET
 * Gets the current roster for a team (defaults to DET - Red Wings) with season stats
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamAbbrev = searchParams.get('team') || 'DET'
    
    // Get roster from NHL API
    const rosterData = await getTeamRosterCurrent(teamAbbrev)
    
    // Calculate current season ID
    const now = new Date()
    const currentYear = now.getFullYear()
    const month = now.getMonth() // 0-11, where 9 = October
    const seasonStartYear = month >= 9 ? currentYear : currentYear - 1
    const seasonId = parseInt(`${seasonStartYear}${seasonStartYear + 1}`)
    
    // Get player stats for current season
    const statsData = await getTeamPlayerStats(teamAbbrev, seasonId, 2) // 2 = regular season
    
    // Create a map of player stats by playerId
    const statsMap = new Map<number, { goals: number; assists: number; points: number; gamesPlayed: number }>()
    statsData.skaters.forEach((stat) => {
      statsMap.set(stat.playerId, {
        goals: stat.goals,
        assists: stat.assists,
        points: stat.points,
        gamesPlayed: stat.gamesPlayed,
      })
    })
    
    // Transform to our format with stats
    const allPlayers = [
      ...rosterData.forwards,
      ...rosterData.defensemen,
      ...rosterData.goalies,
    ]
    
    const formattedRoster = allPlayers.map((player: Player) => {
      // Determine position abbreviation - use positionCode if available, otherwise infer from roster category
      let position = player.positionCode || player.position || 'F'
      if (!position && rosterData.goalies.includes(player)) {
        position = 'G'
      } else if (!position && rosterData.defensemen.includes(player)) {
        position = 'D'
      }
      
      // Get stats for this player
      const playerStats = statsMap.get(player.id) || { goals: 0, assists: 0, points: 0, gamesPlayed: 0 }
      
      return {
        id: String(player.id),
        name: formatPlayerName(player),
        number: String(player.sweaterNumber || ''),
        position: position,
        playerId: player.id,
        firstName: player.firstName?.default || '',
        lastName: player.lastName?.default || '',
        birthDate: player.birthDate,
        goals: playerStats.goals,
        assists: playerStats.assists,
        points: playerStats.points,
        gamesPlayed: playerStats.gamesPlayed,
      }
    })
    
    // Sort by points (most to least)
    formattedRoster.sort((a, b) => (b.points || 0) - (a.points || 0))
    
    return NextResponse.json({
      team: teamAbbrev,
      players: formattedRoster,
      forwards: formattedRoster.filter(p => 
        rosterData.forwards.some((fp: Player) => fp.id === parseInt(p.id))
      ),
      defensemen: formattedRoster.filter(p => 
        rosterData.defensemen.some((dp: Player) => dp.id === parseInt(p.id))
      ),
      goalies: formattedRoster.filter(p => 
        rosterData.goalies.some((gp: Player) => gp.id === parseInt(p.id))
      ),
    })
  } catch (error) {
    console.error('Error fetching NHL roster:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster data' },
      { status: 500 }
    )
  }
}

