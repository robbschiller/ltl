"use client"

import React from 'react'
import { TrophyIcon, TargetIcon } from 'lucide-react'
import type { Game, GameResult, UserPick, Player } from '@/lib/types'
import { calculatePlayerScore, calculateTeamScore, getTopScorerIds } from '@/lib/gameSimulator'

interface GameResultsProps {
  game: Game
  gameResult: GameResult | null
  picks: UserPick[]
  roster: Player[]
  users: Array<{ id: string; name: string }>
  userScores: Map<string, number>
}

interface UserGameScore {
  userId: string
  userName: string
  points: number
  pickType: 'player' | 'team'
  pickName: string
}

export function GameResults({
  game,
  gameResult,
  picks,
  roster,
  users,
  userScores,
}: GameResultsProps) {
  if (!gameResult || game.status !== 'completed') {
    return null
  }

  const topScorerIds = getTopScorerIds(roster)

  // Calculate user scores for this game
  const userGameScores: UserGameScore[] = picks.map((pick) => {
    const user = users.find((u) => u.id === pick.userId)
    let points = 0
    let pickName = ''
    let pickType: 'player' | 'team' = 'player'

    if (pick.playerId === 'team') {
      points = calculateTeamScore(game.teamGoals)
      pickName = 'The Team'
      pickType = 'team'
    } else {
      const playerStats = gameResult.playerStats.find(
        (stats) => stats.playerId === pick.playerId,
      )
      if (playerStats) {
        const isLoneWolf = !topScorerIds.has(pick.playerId)
        points = calculatePlayerScore(playerStats, game, { isLoneWolf })
        const player = roster.find((p) => p.id === pick.playerId)
        pickName = player ? `#${player.number} ${player.name}` : 'Unknown'
      }
    }

    return {
      userId: pick.userId,
      userName: user?.name || 'Unknown',
      points,
      pickType,
      pickName,
    }
  })

  // Sort by points (descending)
  userGameScores.sort((a, b) => b.points - a.points)

  // Get total score for each user
  const getTotalScore = (userId: string) => userScores.get(userId) || 0

  return (
    <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl mb-8">
      <div className="flex items-center gap-3 mb-6">
        <TrophyIcon className="h-6 w-6 text-yellow-400" />
        <h2 className="text-xl font-semibold text-white uppercase tracking-wide">
          Game Results
        </h2>
      </div>

      {/* Final Score */}
      <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">Red Wings</p>
            <p className="text-4xl font-bold text-white">{game.teamGoals}</p>
          </div>
          <div className="text-2xl font-bold text-gray-400">vs</div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">{game.opponent}</p>
            <p className="text-4xl font-bold text-white">{game.opponentGoals}</p>
          </div>
        </div>
        {game.wentToOT && (
          <div className="mt-4 text-center">
            <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm font-medium">
              {game.shootoutOccurred ? 'SO' : 'OT'}
            </span>
          </div>
        )}
      </div>

      {/* Player Stats Summary */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Player Stats
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {gameResult.playerStats
            .filter((stats) => stats.goals.length > 0 || stats.assists.length > 0)
            .map((stats) => {
              const player = roster.find((p) => p.id === stats.playerId)
              if (!player) return null

              const points = calculatePlayerScore(stats, game)
              const goalCount = stats.goals.length
              const assistCount = stats.assists.length
              const shorthandedGoals = stats.goals.filter((g) => g.isShorthanded).length
              const otGoals = stats.goals.filter((g) => g.isOTGoal).length
              const shorthandedAssists = stats.assists.filter((a) => a.isShorthanded).length

              return (
                <div
                  key={stats.playerId}
                  className="bg-white/5 p-4 rounded-xl border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-semibold">
                        #{player.number} {player.name}
                      </p>
                      <p className="text-gray-400 text-sm">{player.position}</p>
                    </div>
                    <div className="flex gap-4 text-center">
                      {goalCount > 0 && (
                        <div>
                          <p className="text-white font-bold">{goalCount}G</p>
                          {shorthandedGoals > 0 && (
                            <p className="text-xs text-blue-400">{shorthandedGoals} SH</p>
                          )}
                          {otGoals > 0 && (
                            <p className="text-xs text-orange-400">{otGoals} OT</p>
                          )}
                        </div>
                      )}
                      {assistCount > 0 && (
                        <div>
                          <p className="text-white font-bold">{assistCount}A</p>
                          {shorthandedAssists > 0 && (
                            <p className="text-xs text-blue-400">{shorthandedAssists} SH</p>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-red-300 font-bold">{points} PTS</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* User Scores */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Scores for This Game
        </h3>
        <div className="space-y-3">
          {userGameScores.map((score, index) => {
            const isWinner = index === 0 && score.points > 0
            const totalScore = getTotalScore(score.userId)

            return (
              <div
                key={score.userId}
                className={`backdrop-blur-xl p-5 rounded-2xl border transition-all ${
                  isWinner
                    ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex flex-col items-center justify-center min-w-[3rem]">
                      <div className="text-2xl font-bold text-white">
                        {score.points}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        pts
                      </div>
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-white">{score.userName}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Picked: {score.pickName}
                        {score.pickType === 'team' && (
                          <span className="ml-2 text-xs bg-blue-500/30 px-2 py-0.5 rounded-full">
                            Team
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400">Season Total</p>
                    <p className="text-xl font-bold text-red-300">{totalScore}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
