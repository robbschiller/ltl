import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  formatPlayerName,
  getGameBoxscore,
  getGameLanding,
  getGamePlayByPlay,
  getTeamRosterCurrent,
} from '@/lib/nhlApi'
import { parseRealGameResults } from '@/lib/parseGameResults'
import type { Game as AppGame, Player } from '@/lib/types'

const RED_WINGS_ABBREV = 'DET'

async function getCurrentRoster(): Promise<Player[]> {
  const rosterData = await getTeamRosterCurrent(RED_WINGS_ABBREV)
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
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
    })

    if (!game || !game.nhlGameId || !game.finalizedAt) {
      return NextResponse.json({ game: null }, { status: 200 })
    }

    const [boxscoreRaw, landing, playByPlay, roster, picks] = await Promise.all([
      getGameBoxscore(game.nhlGameId),
      getGameLanding(game.nhlGameId),
      getGamePlayByPlay(game.nhlGameId).catch(() => null),
      getCurrentRoster(),
      prisma.pick.findMany({ where: { gameId: game.id } }),
    ])
    const boxscore = (boxscoreRaw as any)?.boxscore || boxscoreRaw

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

    return NextResponse.json({ game, gameResult, picks }, { status: 200 })
  } catch (error) {
    console.error('Error fetching game result:', error)
    return NextResponse.json({ error: 'Failed to fetch game result' }, { status: 500 })
  }
}
