import { NextRequest, NextResponse } from "next/server"

// Test endpoint to verify NHL API connectivity
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  // Test 1: Basic schedule endpoint
  try {
    const url1 = 'https://statsapi.web.nhl.com/api/v1/schedule?teamId=17&startDate=2024-11-01&endDate=2024-11-30'
    console.log('Testing:', url1)
    const response1 = await fetch(url1, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LightTheLamp/1.0)',
      },
    })
    
    results.tests.push({
      endpoint: 'Schedule (teamId=17)',
      url: url1,
      status: response1.status,
      statusText: response1.statusText,
      ok: response1.ok,
      dataPreview: null,
      error: null
    })

    if (response1.ok) {
      const data = await response1.json()
      results.tests[results.tests.length - 1].dataPreview = {
        totalDates: data.dates?.length || 0,
        totalGames: data.dates?.reduce((sum: number, date: any) => sum + (date.games?.length || 0), 0) || 0,
        firstGame: data.dates?.[0]?.games?.[0] ? {
          gamePk: data.dates[0].games[0].gamePk,
          gameDate: data.dates[0].games[0].gameDate,
          homeTeam: data.dates[0].games[0].teams?.home?.team?.name,
          awayTeam: data.dates[0].games[0].teams?.away?.team?.name
        } : null
      }
    }
  } catch (error: any) {
    results.tests[results.tests.length - 1].error = {
      message: error.message,
      code: error.code,
      errno: error.errno
    }
  }

  // Test 2: Simple teams endpoint
  try {
    const url2 = 'https://statsapi.web.nhl.com/api/v1/teams'
    console.log('Testing:', url2)
    const response2 = await fetch(url2, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LightTheLamp/1.0)',
      },
    })
    
    results.tests.push({
      endpoint: 'Teams list',
      url: url2,
      status: response2.status,
      statusText: response2.statusText,
      ok: response2.ok,
      dataPreview: null,
      error: null
    })

    if (response2.ok) {
      const data = await response2.json()
      results.tests[results.tests.length - 1].dataPreview = {
        totalTeams: data.teams?.length || 0,
        detroitTeam: data.teams?.find((t: any) => t.id === 17) ? {
          id: data.teams.find((t: any) => t.id === 17).id,
          name: data.teams.find((t: any) => t.id === 17).name
        } : null
      }
    }
  } catch (error: any) {
    results.tests[results.tests.length - 1].error = {
      message: error.message,
      code: error.code,
      errno: error.errno
    }
  }

  // Test 3: Detroit Red Wings roster
  try {
    const url3 = 'https://statsapi.web.nhl.com/api/v1/teams/17/roster'
    console.log('Testing:', url3)
    const response3 = await fetch(url3, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LightTheLamp/1.0)',
      },
    })
    
    results.tests.push({
      endpoint: 'Detroit Red Wings roster',
      url: url3,
      status: response3.status,
      statusText: response3.statusText,
      ok: response3.ok,
      dataPreview: null,
      error: null
    })

    if (response3.ok) {
      const data = await response3.json()
      results.tests[results.tests.length - 1].dataPreview = {
        rosterSize: data.roster?.length || 0,
        firstPlayer: data.roster?.[0] ? {
          name: data.roster[0].person?.fullName,
          position: data.roster[0].position?.name,
          number: data.roster[0].jerseyNumber
        } : null
      }
    }
  } catch (error: any) {
    results.tests[results.tests.length - 1].error = {
      message: error.message,
      code: error.code,
      errno: error.errno
    }
  }

  // Test 4: Try alternative endpoint format
  try {
    const url4 = 'https://statsapi.web.nhl.com/api/v1/schedule?expand=schedule.teams,schedule.linescore&teamId=17&date=2024-11-01'
    console.log('Testing:', url4)
    const response4 = await fetch(url4, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LightTheLamp/1.0)',
      },
    })
    
    results.tests.push({
      endpoint: 'Schedule with expand params',
      url: url4,
      status: response4.status,
      statusText: response4.statusText,
      ok: response4.ok,
      dataPreview: null,
      error: null
    })

    if (response4.ok) {
      const data = await response4.json()
      results.tests[results.tests.length - 1].dataPreview = {
        totalDates: data.dates?.length || 0,
        hasGames: (data.dates?.[0]?.games?.length || 0) > 0
      }
    }
  } catch (error: any) {
    results.tests[results.tests.length - 1].error = {
      message: error.message,
      code: error.code,
      errno: error.errno
    }
  }

  // Test 5: Try without teamId to see if it's a general connectivity issue
  try {
    const url5 = 'https://statsapi.web.nhl.com/api/v1/schedule?date=2024-11-01'
    console.log('Testing:', url5)
    const response5 = await fetch(url5, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LightTheLamp/1.0)',
      },
    })
    
    results.tests.push({
      endpoint: 'Schedule (no team filter)',
      url: url5,
      status: response5.status,
      statusText: response5.statusText,
      ok: response5.ok,
      dataPreview: null,
      error: null
    })

    if (response5.ok) {
      const data = await response5.json()
      results.tests[results.tests.length - 1].dataPreview = {
        totalDates: data.dates?.length || 0,
        totalGames: data.dates?.reduce((sum: number, date: any) => sum + (date.games?.length || 0), 0) || 0
      }
    }
  } catch (error: any) {
    results.tests[results.tests.length - 1].error = {
      message: error.message,
      code: error.code,
      errno: error.errno
    }
  }

  // Summary
  const successful = results.tests.filter((t: any) => t.ok).length
  const failed = results.tests.filter((t: any) => !t.ok || t.error).length
  
  results.summary = {
    totalTests: results.tests.length,
    successful,
    failed,
    successRate: `${((successful / results.tests.length) * 100).toFixed(1)}%`
  }

  return NextResponse.json(results, { status: 200 })
}

