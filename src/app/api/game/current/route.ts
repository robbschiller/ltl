import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpcomingRedWingsGame } from '@/lib/nhlGameSelection'

export async function GET() {
  try {
    const nhlGame = await getUpcomingRedWingsGame()

    if (!nhlGame) {
      return NextResponse.json({ error: 'No upcoming game found' }, { status: 404 })
    }

    const gameId = String(nhlGame.id)
    const isHome = nhlGame.homeTeam.abbrev === 'DET'
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

    const game = await prisma.game.upsert({
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
    })
  } catch (error) {
    console.error('Error fetching current game:', error)
    return NextResponse.json({ error: 'Failed to fetch current game' }, { status: 500 })
  }
}
