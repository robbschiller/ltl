import { NextResponse } from 'next/server'
import { getRedWingsCurrentSeasonSchedule } from '@/lib/nhlApi'

export async function GET() {
  try {
    const COMPLETED_STATES = new Set(['OFF', 'FINAL', 'OFFICIAL'])
    const scheduleGames = await getRedWingsCurrentSeasonSchedule()

    const games = scheduleGames
      .filter((game) => COMPLETED_STATES.has(game.gameState))
      .map((game) => {
        const isHome = game.homeTeam.abbrev === 'DET'
        const opponent = isHome ? game.awayTeam : game.homeTeam
        const redWings = isHome ? game.homeTeam : game.awayTeam
        const gameDate = new Date(game.startTimeUTC)
        const dateStr = gameDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const timeStr = gameDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
          timeZoneName: 'short',
        })
        const lastPeriodType = game.gameOutcome?.lastPeriodType
        const wentToOT = lastPeriodType === 'OT' || lastPeriodType === 'SO'
        const shootoutOccurred = lastPeriodType === 'SO'

        return {
          id: String(game.id),
          nhlGameId: game.id,
          opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
          opponentLogo: opponent.logo,
          date: dateStr,
          time: timeStr,
          venue: game.venue.default,
          isHome,
          startTimeUTC: game.startTimeUTC,
          status: 'completed',
          teamGoals: redWings.score ?? 0,
          opponentGoals: opponent.score ?? 0,
          wentToOT,
          shootoutOccurred,
          emptyNetGoals: 0,
        }
      })
      .sort(
        (a, b) =>
          new Date(b.startTimeUTC).getTime() - new Date(a.startTimeUTC).getTime(),
      )

    return NextResponse.json({ games }, { status: 200 })
  } catch (error) {
    console.error('Error fetching game history:', error)
    return NextResponse.json({ error: 'Failed to fetch game history' }, { status: 500 })
  }
}
