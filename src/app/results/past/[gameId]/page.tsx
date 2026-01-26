"use client"

import React, { useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { calculatePlayerScore } from '@/lib/gameSimulator'
import { findPlayerStats } from '@/lib/playerUtils'
import type { Player, Game, GameResult, UserPick } from '@/lib/types'

export default function PastGameDetailPage() {
  const router = useRouter()
  const params = useParams()
  const gameId = params?.gameId as string
  const { currentUser, loading: authLoading } = useAuth()

  const [game, setGame] = React.useState<Game | null>(null)
  const [gameResult, setGameResult] = React.useState<GameResult | null>(null)
  const [picks, setPicks] = React.useState<UserPick[]>([])
  const [users, setUsers] = React.useState<Array<{ id: string; name: string }>>([])
  const [userScores, setUserScores] = React.useState<Map<string, number>>(new Map())
  const [roster, setRoster] = React.useState<Player[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login')
      return
    }
  }, [authLoading, currentUser, router])

  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        const [resultRes, rosterRes, usersRes] = await Promise.all([
          fetch(`/api/game/result?gameId=${gameId}`),
          fetch('/api/nhl/roster?team=DET'),
          fetch('/api/users'),
        ])

        if (resultRes.ok) {
          const data = await resultRes.json()
          setGame(data.game || null)
          setGameResult(data.gameResult || null)
          setPicks(data.picks || [])
        }

        if (rosterRes.ok) {
          const rosterData = await rosterRes.json()
          setRoster(rosterData.players || [])
        }

        if (usersRes.ok) {
          const userData = await usersRes.json()
          if (Array.isArray(userData.users)) {
            setUsers(userData.users.map((u: any) => ({ id: u.id, name: u.name })))
            const scores = new Map<string, number>()
            userData.users.forEach((u: any) => {
              if (u.totalSeasonPoints) scores.set(u.id, u.totalSeasonPoints)
            })
            setUserScores(scores)
          }
        }
      } catch (error) {
        console.error('Error loading past game:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (gameId) {
      fetchData()
    }
  }, [gameId])

  const recalculatedScores = useMemo(() => {
    if (!game || !gameResult || picks.length === 0) {
      return new Map<string, number>()
    }

    const scores = new Map<string, number>()

    picks.forEach((pick) => {
      if (pick.playerId === 'team') {
        scores.set(pick.userId, gameResult.teamPoints)
      } else {
        const player = roster.find((p) => p.id === pick.playerId)
        if (player) {
          const playerStats = findPlayerStats(player, gameResult.playerStats)
          if (playerStats) {
            scores.set(pick.userId, calculatePlayerScore(playerStats, game))
          } else {
            scores.set(pick.userId, 0)
          }
        } else {
          scores.set(pick.userId, 0)
        }
      }
    })

    return scores
  }, [game, gameResult, picks, roster])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading game...</p>
        </div>
      </div>
    )
  }

  if (!game || !gameResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
            <p className="text-gray-300 text-lg mb-2">No results found for this game.</p>
            <button
              onClick={() => router.push('/results/past')}
              className="px-6 py-3 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all"
            >
              Back to Past Results
            </button>
          </div>
        </div>
      </div>
    )
  }

  const userGameScores = picks.map((pick) => {
    const user = users.find((u) => u.id === pick.userId)
    const points = recalculatedScores.get(pick.userId) ?? 0
    const pickName =
      pick.playerId === 'team'
        ? 'The Team'
        : roster.find((p) => p.id === pick.playerId)?.name || 'Unknown Player'
    return {
      userId: pick.userId,
      userName: user?.name || 'Unknown',
      points,
      pickName,
      seasonTotal: userScores.get(pick.userId) || 0,
    }
  })

  userGameScores.sort((a, b) => b.points - a.points)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <button
          onClick={() => router.push('/results/past')}
          className="mb-6 px-4 py-2 rounded-xl font-semibold bg-gray-600 hover:bg-gray-700 text-white shadow-lg transition-all"
        >
          Back to Past Results
        </button>

        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Red Wings</p>
              <p className="text-5xl font-bold text-white">{game.teamGoals}</p>
            </div>
            <div className="text-3xl font-bold text-gray-400">vs</div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">{game.opponent}</p>
              <p className="text-5xl font-bold text-white">{game.opponentGoals}</p>
            </div>
          </div>
          {game.wentToOT && (
            <div className="mt-4 text-center">
              <span className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-full text-sm font-medium">
                {game.shootoutOccurred ? 'Shootout' : 'Overtime'}
              </span>
            </div>
          )}
        </div>

        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Scores</h2>
          <div className="space-y-3">
            {userGameScores.map((score) => (
              <div key={score.userId} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
                <div>
                  <p className="text-white font-semibold">{score.userName}</p>
                  <p className="text-sm text-gray-400">Picked: {score.pickName}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{score.points} pts</p>
                  <p className="text-sm text-gray-400">Season: {score.seasonTotal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Player Stats</h2>
          <div className="space-y-2">
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
      </div>
    </div>
  )
}
