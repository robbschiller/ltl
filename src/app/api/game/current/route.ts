import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpcomingRedWingsGame } from '@/lib/nhlGameSelection'
import { getScoreForDate } from '@/lib/nhlApi'

const RED_WINGS_ABBREV = 'DET'
const LIVE_STATES = new Set(['LIVE', 'CRITM'])
const COMPLETED_STATES = new Set(['OFF', 'FINAL', 'OFFICIAL'])

function toDateKey(dateStr?: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const pickGameIds = await prisma.pick.findMany({
      distinct: ['gameId'],
      select: { gameId: true },
    })
    const trackedGameIds = pickGameIds.map((pick) => pick.gameId)

    let game = trackedGameIds.length
      ? await prisma.game.findFirst({
          where: {
            id: { in: trackedGameIds },
            finalizedAt: null,
          },
          orderBy: { startTimeUTC: 'asc' },
        })
      : null

    if (!game) {
      const nhlGame = await getUpcomingRedWingsGame()

      if (!nhlGame) {
        return NextResponse.json({ error: 'No upcoming game found' }, { status: 404 })
      }

      const gameId = String(nhlGame.id)
      const isHome = nhlGame.homeTeam.abbrev === RED_WINGS_ABBREV
      const opponent = isHome ? nhlGame.awayTeam : nhlGame.homeTeam
      const gameDate = new Date(nhlGame.startTimeUTC)
      const dateStr = gameDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York',
      })
      const timeStr = gameDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      })

      const existingGame = await prisma.game.findUnique({ where: { id: gameId } })
      const nextStatus =
        existingGame?.finalizedAt || existingGame?.status === 'completed'
          ? 'completed'
          : 'upcoming'

      game = await prisma.game.upsert({
        where: { id: gameId },
        create: {
          id: gameId,
          nhlGameId: nhlGame.id,
          opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
          opponentLogo: opponent.logo,
          date: dateStr,
          time: timeStr,
          venue: nhlGame.venue.default,
          isHome,
          startTimeUTC: nhlGame.startTimeUTC,
          status: nextStatus,
        },
        update: {
          opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
          opponentLogo: opponent.logo,
          date: dateStr,
          time: timeStr,
          venue: nhlGame.venue.default,
          isHome,
          startTimeUTC: nhlGame.startTimeUTC,
          status: nextStatus,
        },
      })
    }

    let gameState: string | null = null
    let period: number | null = null
    let clock: string | null = null
    let inIntermission = false

    if (game.nhlGameId) {
      const dateKey = toDateKey(game.startTimeUTC)
      if (dateKey) {
        const scoreData = await getScoreForDate(dateKey)
        const scoreGame = scoreData?.games?.find(
          (scheduled: { id?: number }) => String(scheduled.id) === String(game?.nhlGameId),
        )

        if (scoreGame) {
          const isHome = scoreGame.homeTeam?.abbrev === RED_WINGS_ABBREV
          const redWingsTeam = isHome ? scoreGame.homeTeam : scoreGame.awayTeam
          const opponentTeam = isHome ? scoreGame.awayTeam : scoreGame.homeTeam
          gameState = scoreGame.gameState || null
          period = scoreGame.periodDescriptor?.number ?? null
          clock = scoreGame.clock?.timeRemaining ?? scoreGame.clock?.timeRemainingInPeriod ?? null
          inIntermission = Boolean(scoreGame.clock?.inIntermission)

          let nextStatus = game.status
          if (COMPLETED_STATES.has(scoreGame.gameState)) {
            nextStatus = 'completed'
          } else if (LIVE_STATES.has(scoreGame.gameState)) {
            nextStatus = 'live'
          } else {
            nextStatus = 'upcoming'
          }

          const lastPeriodType = scoreGame.gameOutcome?.lastPeriodType
          const wentToOT = lastPeriodType === 'OT' || lastPeriodType === 'SO'
          const shootoutOccurred = lastPeriodType === 'SO'

          game = await prisma.game.update({
            where: { id: game.id },
            data: {
              status: nextStatus,
              teamGoals: Number(redWingsTeam?.score ?? 0),
              opponentGoals: Number(opponentTeam?.score ?? 0),
              wentToOT,
              shootoutOccurred,
            },
          })
        }
      }
    }

    const [picksCount, usersCount] = await Promise.all([
      prisma.pick.count({ where: { gameId: game.id } }),
      prisma.user.count(),
    ])

    const picksLocked = usersCount > 0 && picksCount >= usersCount

    if (picksLocked && !game.lockedAt) {
      await prisma.game.update({
        where: { id: game.id },
        data: { lockedAt: new Date() },
      })
    }

    return NextResponse.json({
      game,
      picksLocked,
      picksCount,
      usersCount,
      gameState,
      period,
      clock,
      inIntermission,
    })
  } catch (error) {
    console.error('Error fetching current game:', error)
    return NextResponse.json({ error: 'Failed to fetch current game' }, { status: 500 })
  }
}
