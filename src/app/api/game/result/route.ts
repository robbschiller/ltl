import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  formatPlayerName,
  getGameBoxscore,
  getGameLanding,
  getGamePlayByPlay,
  getRedWingsCurrentSeasonSchedule,
  getTeamPlayerStats,
  getTeamRosterCurrent,
} from '@/lib/nhlApi'
import { parseRealGameResults } from '@/lib/parseGameResults'
import type { Game as AppGame, Player } from '@/lib/types'

const RED_WINGS_ABBREV = 'DET'

async function getCurrentRoster(): Promise<Player[]> {
  const rosterData = await getTeamRosterCurrent(RED_WINGS_ABBREV)
  const now = new Date()
  const currentYear = now.getFullYear()
  const month = now.getMonth()
  const seasonStartYear = month >= 9 ? currentYear : currentYear - 1
  const seasonId = parseInt(`${seasonStartYear}${seasonStartYear + 1}`)
  const statsData = await getTeamPlayerStats(RED_WINGS_ABBREV, seasonId, 2)
  const statsMap = new Map<number, { goals: number; assists: number; points: number; gamesPlayed: number }>()
  statsData.skaters.forEach((stat) => {
    statsMap.set(stat.playerId, {
      goals: stat.goals,
      assists: stat.assists,
      points: stat.points,
      gamesPlayed: stat.gamesPlayed,
    })
  })
  const allPlayers = [
    ...rosterData.forwards,
    ...rosterData.defensemen,
    ...rosterData.goalies,
  ]

  return allPlayers.map((player) => ({
    id: String(player.id),
    name: formatPlayerName(player),
    number: String(player.sweaterNumber || ''),
    position: player.positionCode || player.position || 'F',
    ...(statsMap.has(player.id)
      ? statsMap.get(player.id)
      : { goals: 0, assists: 0, points: 0, gamesPlayed: 0 }),
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
    }

    const numericGameId = Number(gameId)
    if (Number.isNaN(numericGameId)) {
      return NextResponse.json({ error: 'gameId must be numeric' }, { status: 400 })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
    })

    let scheduleGame: any = null
    if (!game || !game.nhlGameId || !game.finalizedAt) {
      const scheduleGames = await getRedWingsCurrentSeasonSchedule()
      scheduleGame = scheduleGames.find((scheduled) => String(scheduled.id) === gameId)
      if (!scheduleGame) {
        return NextResponse.json({ game: null }, { status: 200 })
      }
    }

    const nhlGameId = game?.nhlGameId ?? scheduleGame?.id
    if (!nhlGameId) {
      return NextResponse.json({ game: null }, { status: 200 })
    }

    const [boxscoreRaw, landing, playByPlay, roster, picks] = await Promise.all([
      getGameBoxscore(nhlGameId),
      getGameLanding(nhlGameId),
      getGamePlayByPlay(nhlGameId).catch(() => null),
      getCurrentRoster(),
      prisma.pick.findMany({ where: { gameId: game?.id ?? gameId } }),
    ])
    const boxscore = (boxscoreRaw as any)?.boxscore || boxscoreRaw

    const fallbackGame: AppGame | null = scheduleGame
      ? (() => {
          const isHome = scheduleGame.homeTeam.abbrev === 'DET'
          const opponent = isHome ? scheduleGame.awayTeam : scheduleGame.homeTeam
          const redWings = isHome ? scheduleGame.homeTeam : scheduleGame.awayTeam
          const gameDate = new Date(scheduleGame.startTimeUTC)
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
          const lastPeriodType = scheduleGame.gameOutcome?.lastPeriodType
          const wentToOT = lastPeriodType === 'OT' || lastPeriodType === 'SO'
          const shootoutOccurred = lastPeriodType === 'SO'

          return {
            id: String(scheduleGame.id),
            opponent: opponent.placeName.default + ' ' + opponent.commonName.default,
            opponentLogo: opponent.logo,
            date: dateStr,
            time: timeStr,
            venue: scheduleGame.venue.default,
            isHome,
            status: 'completed',
            teamGoals: redWings.score ?? 0,
            opponentGoals: opponent.score ?? 0,
            wentToOT,
            emptyNetGoals: 0,
            shootoutOccurred,
            gameId: scheduleGame.id,
            startTimeUTC: scheduleGame.startTimeUTC,
          }
        })()
      : null

    const gameForParsing: AppGame = {
      id: game?.id ?? fallbackGame?.id ?? String(nhlGameId),
      opponent: game?.opponent ?? fallbackGame?.opponent ?? '',
      opponentLogo: game?.opponentLogo ?? fallbackGame?.opponentLogo ?? '',
      date: game?.date ?? fallbackGame?.date ?? '',
      time: game?.time ?? fallbackGame?.time ?? '',
      venue: game?.venue ?? fallbackGame?.venue ?? '',
      isHome: game?.isHome ?? fallbackGame?.isHome ?? false,
      status: 'completed',
      teamGoals: game?.teamGoals ?? fallbackGame?.teamGoals ?? 0,
      opponentGoals: game?.opponentGoals ?? fallbackGame?.opponentGoals ?? 0,
      wentToOT: game?.wentToOT ?? fallbackGame?.wentToOT ?? false,
      emptyNetGoals: game?.emptyNetGoals ?? fallbackGame?.emptyNetGoals ?? 0,
      shootoutOccurred: game?.shootoutOccurred ?? fallbackGame?.shootoutOccurred ?? false,
      gameId: nhlGameId,
    }

    const gameResult = parseRealGameResults(
      {
        boxscore,
        landing,
        playByPlay,
        game: boxscore,
      },
      gameForParsing,
      roster,
      playByPlay || undefined,
    )

    if (!gameResult.playerStats || gameResult.playerStats.length === 0) {
      return NextResponse.json({ game: null }, { status: 200 })
    }

    const responseGame = game ?? fallbackGame
    return NextResponse.json({ game: responseGame, gameResult, picks }, { status: 200 })
  } catch (error) {
    console.error('Error fetching game result:', error)
    return NextResponse.json({ error: 'Failed to fetch game result' }, { status: 500 })
  }
}
