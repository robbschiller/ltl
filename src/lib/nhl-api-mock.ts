// Mock NHL API data for development when real API is unavailable
// Set USE_MOCK_NHL_API=true in your .env to use this

export interface MockGame {
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

export interface MockRosterPlayer {
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

/**
 * Generate mock games for the next 30 days
 */
export function generateMockGames(): MockGame[] {
  const games: MockGame[] = []
  const today = new Date()
  
  // Common NHL opponents for Detroit Red Wings
  const opponents = [
    'Tampa Bay Lightning',
    'Toronto Maple Leafs',
    'Chicago Blackhawks',
    'Boston Bruins',
    'Montreal Canadiens',
    'Pittsburgh Penguins',
    'New York Rangers',
    'Colorado Avalanche',
    'Minnesota Wild',
    'St. Louis Blues'
  ]
  
  let gamePk = 2024020001 // Mock game IDs
  
  // Generate games for next 30 days (roughly every 2-3 days)
  for (let i = 0; i < 10; i++) {
    const gameDate = new Date(today)
    gameDate.setDate(today.getDate() + i * 3)
    gameDate.setHours(19, 0, 0, 0) // 7 PM local time
    
    const isHome = i % 2 === 0
    const opponent = opponents[i % opponents.length]
    
    games.push({
      gamePk: gamePk++,
      gameDate: gameDate.toISOString(),
      status: {
        abstractGameState: gameDate > today ? 'Live' : 'Final',
        detailedState: gameDate > today ? 'Scheduled' : 'Final'
      },
      teams: {
        away: {
          team: {
            id: isHome ? 20 : 17, // Random team ID vs Detroit (17)
            name: isHome ? opponent : 'Detroit Red Wings'
          },
          score: gameDate < today ? Math.floor(Math.random() * 5) : undefined
        },
        home: {
          team: {
            id: isHome ? 17 : 20, // Detroit is home
            name: isHome ? 'Detroit Red Wings' : opponent
          },
          score: gameDate < today ? Math.floor(Math.random() * 5) : undefined
        }
      }
    })
  }
  
  return games
}

/**
 * Generate mock roster with common Red Wings players
 */
export function generateMockRoster(): MockRosterPlayer[] {
  return [
    // Forwards
    { person: { id: 8467879, fullName: 'Dylan Larkin' }, jerseyNumber: '71', position: { code: 'C', name: 'Center', type: 'Forward' } },
    { person: { id: 8479351, fullName: 'Lucas Raymond' }, jerseyNumber: '23', position: { code: 'LW', name: 'Left Wing', type: 'Forward' } },
    { person: { id: 8477934, fullName: 'Alex DeBrincat' }, jerseyNumber: '93', position: { code: 'RW', name: 'Right Wing', type: 'Forward' } },
    { person: { id: 8479984, fullName: 'Patrick Kane' }, jerseyNumber: '88', position: { code: 'RW', name: 'Right Wing', type: 'Forward' } },
    { person: { id: 8476346, fullName: 'Andrew Copp' }, jerseyNumber: '18', position: { code: 'C', name: 'Center', type: 'Forward' } },
    { person: { id: 8480800, fullName: 'Marco Kasper' }, jerseyNumber: '24', position: { code: 'C', name: 'Center', type: 'Forward' } },
    { person: { id: 8478474, fullName: 'J.T. Compher' }, jerseyNumber: '37', position: { code: 'C', name: 'Center', type: 'Forward' } },
    { person: { id: 8476879, fullName: 'David Perron' }, jerseyNumber: '57', position: { code: 'LW', name: 'Left Wing', type: 'Forward' } },
    { person: { id: 8478864, fullName: 'Robbie Fabbri' }, jerseyNumber: '14', position: { code: 'C', name: 'Center', type: 'Forward' } },
    { person: { id: 8477953, fullName: 'Christian Fischer' }, jerseyNumber: '36', position: { code: 'RW', name: 'Right Wing', type: 'Forward' } },
    
    // Defensemen
    { person: { id: 8478460, fullName: 'Moritz Seider' }, jerseyNumber: '53', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    { person: { id: 8475786, fullName: 'Jeff Petry' }, jerseyNumber: '46', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    { person: { id: 8476919, fullName: 'Shayne Gostisbehere' }, jerseyNumber: '41', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    { person: { id: 8478420, fullName: 'Ben Chiarot' }, jerseyNumber: '8', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    { person: { id: 8478492, fullName: 'Olli Määttä' }, jerseyNumber: '2', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    { person: { id: 8477384, fullName: 'Justin Holl' }, jerseyNumber: '3', position: { code: 'D', name: 'Defenseman', type: 'Defenseman' } },
    
    // Goalies
    { person: { id: 8471214, fullName: 'Alex Lyon' }, jerseyNumber: '34', position: { code: 'G', name: 'Goalie', type: 'Goalie' } },
    { person: { id: 8476381, fullName: 'James Reimer' }, jerseyNumber: '47', position: { code: 'G', name: 'Goalie', type: 'Goalie' } },
  ]
}

