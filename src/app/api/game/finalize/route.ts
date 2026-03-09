import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  formatPlayerName,
  getGameBoxscore,
  getGameLanding,
  getGamePlayByPlay,
  getScoreForDate,
  getTeamPlayerStats,
  getTeamRosterCurrent,
} from '@/lib/nhlApi'
import { parseRealGameResults } from '@/lib/parseGameResults'
import { calculateUserScores } from '@/lib/gameSimulator'
import type { Game as AppGame, Player } from '@/lib/types'

const RED_WINGS_ABBREV = 'DET'
const COMPLETED_STATES = new Set(['OFF', 'FINAL', 'OFFICIAL'])

function toDateKey(dateStr?: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

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
    const gameIdParam = searchParams.get('gameId')

    let game = gameIdParam
      ? await prisma.game.findUnique({ where: { id: gameIdParam } })
      : null

    if (!game) {
      const pickGameIds = await prisma.pick.findMany({
        distinct: ['gameId'],
        select: { gameId: true },
      })
      const gameIds = pickGameIds.map((pick) => pick.gameId)

      if (gameIds.length > 0) {
        game = await prisma.game.findFirst({
          where: {
            id: { in: gameIds },
            finalizedAt: null,
          },
          orderBy: { startTimeUTC: 'asc' },
        })
      }
    }

    if (!game) {
      return NextResponse.json({ status: 'noop' }, { status: 200 })
    }

    if (game.finalizedAt) {
      return NextResponse.json({ status: 'already-finalized', gameId: game.id }, { status: 200 })
    }

    const nhlGameId = game.nhlGameId

    if (!nhlGameId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing NHL game ID' },
        { status: 400 },
      )
    }

    const dateKey = toDateKey(game.startTimeUTC)
    if (!dateKey) {
      return NextResponse.json(
        { status: 'pending', message: 'Missing game date' },
        { status: 200 },
      )
    }

    const scoreData = await getScoreForDate(dateKey)
    const scoreGame = scoreData?.games?.find(
      (scoreGame: { id?: number }) => String(scoreGame.id) === String(nhlGameId),
    )

    if (!scoreGame || !COMPLETED_STATES.has(scoreGame.gameState)) {
      return NextResponse.json({ status: 'pending' }, { status: 200 })
    }

    const [boxscoreRaw, landing, playByPlay, roster] = await Promise.all([
      getGameBoxscore(nhlGameId),
      getGameLanding(nhlGameId),
      getGamePlayByPlay(nhlGameId).catch(() => null),
      getCurrentRoster(),
    ])
    const boxscoreContainer = boxscoreRaw as { boxscore?: unknown }
    const boxscore = boxscoreContainer.boxscore || boxscoreRaw

    const gameForParsing: AppGame = {
      id: game.id,
      opponent: game.opponent,
      opponentLogo: game.opponentLogo,
      date: game.date,
      time: game.time,
      venue: game.venue,
      isHome: game.isHome,
      status: 'completed',
      teamGoals: game.teamGoals || 0,
      opponentGoals: game.opponentGoals || 0,
      wentToOT: game.wentToOT,
      emptyNetGoals: game.emptyNetGoals,
      shootoutOccurred: game.shootoutOccurred,
      gameId: game.nhlGameId || undefined,
    }

    const result = parseRealGameResults(
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

    if (!result.playerStats || result.playerStats.length === 0) {
      return NextResponse.json(
        { status: 'pending', message: 'Boxscore missing player stats' },
        { status: 200 },
      )
    }

    const picksRaw = await prisma.pick.findMany({ where: { gameId: game.id } })
    const picks = picksRaw.map((pick) => ({
      userId: pick.userId,
      gameId: pick.gameId,
      playerId: pick.playerId,
      playerPosition: pick.playerPosition ?? undefined,
    }))
    const scores = calculateUserScores(picks, result, roster, gameForParsing)

    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: game.id },
        data: {
          status: 'completed',
          teamGoals: gameForParsing.teamGoals,
          opponentGoals: gameForParsing.opponentGoals,
          wentToOT: gameForParsing.wentToOT,
          shootoutOccurred: gameForParsing.shootoutOccurred,
          emptyNetGoals: gameForParsing.emptyNetGoals,
          finalizedAt: game.finalizedAt || new Date(),
        },
      })

      for (const [userId, points] of scores.entries()) {
        await tx.gameUserScore.upsert({
          where: {
            gameId_userId: {
              gameId: game.id,
              userId,
            },
          },
          update: { points },
          create: {
            gameId: game.id,
            userId,
            points,
          },
        })
      }

      const allUsers = await tx.user.findMany({
        select: { id: true },
      })

      for (const user of allUsers) {
        const sum = await tx.gameUserScore.aggregate({
          where: { userId: user.id },
          _sum: { points: true },
        })

        await tx.userScore.upsert({
          where: { userId: user.id },
          update: { totalSeasonPoints: sum._sum.points || 0 },
          create: { userId: user.id, totalSeasonPoints: sum._sum.points || 0 },
        })
      }
    })

    // Rotate pick order after successful finalization
    try {
      const pickOrder = await prisma.pickOrder.findFirst({
        orderBy: { updatedAt: 'desc' },
      })
      if (pickOrder?.userIds) {
        const userIds = JSON.parse(pickOrder.userIds) as string[]
        if (userIds.length > 0) {
          const rotated = [...userIds.slice(1), userIds[0]]
          await prisma.pickOrder.update({
            where: { id: pickOrder.id },
            data: { userIds: JSON.stringify(rotated) },
          })
        }
      }
    } catch (error) {
      console.error('Error rotating pick order after finalize:', error)
    }

    return NextResponse.json({
      status: 'finalized',
      gameId: game.id,
      userScores: Object.fromEntries(scores),
    })
  } catch (error) {
    console.error('Error finalizing game:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to finalize game' },
      { status: 500 },
    )
  }
}
