"use client"

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/contexts/GameContext'
import { TrophyIcon, ArrowLeftIcon, TargetIcon } from 'lucide-react'
import { calculatePlayerScore, calculateUserScores } from '@/lib/gameSimulator'
import type { Player } from '@/lib/types'

export default function ResultsPage() {
  const router = useRouter()
  const {
    currentGame,
    gameResults,
    currentPicks,
    users,
    userScores,
    gameUserScores,
    isLoading,
  } = useGame()

  // Get the most recent completed game
  const completedGame = useMemo(() => {
    // If currentGame is completed, use it
    if (currentGame && currentGame.status === 'completed') {
      return currentGame
    }
    // If currentGame exists but isn't marked completed, check if we have results for it
    if (currentGame && gameResults.length > 0) {
      const hasResult = gameResults.some((r) => r.gameId === currentGame.id)
      if (hasResult) {
        // We have results, so treat it as completed even if status isn't set
        return { ...currentGame, status: 'completed' as const }
      }
    }
    // If we have gameResults but no currentGame match, use the most recent result's game
    if (gameResults.length > 0 && currentGame) {
      // Try to find a result that matches currentGame
      const matchingResult = gameResults.find((r) => r.gameId === currentGame.id)
      if (matchingResult) {
        return { ...currentGame, status: 'completed' as const }
      }
      // Otherwise, use the most recent result
      const mostRecentResult = gameResults[gameResults.length - 1]
      if (mostRecentResult && currentGame.id === mostRecentResult.gameId) {
        return { ...currentGame, status: 'completed' as const }
      }
    }
    return null
  }, [currentGame, gameResults])

  const gameResult = useMemo(() => {
    if (!completedGame) return null
    const result = gameResults.find((r) => r.gameId === completedGame.id) || null
    
    // Validate that the result has playerStats
    if (result && (!result.playerStats || result.playerStats.length === 0)) {
      console.warn('[RESULTS] Found gameResult but it has no playerStats. This might be corrupted data.', {
        gameId: result.gameId,
        resultKeys: Object.keys(result),
      })
    }
    
    return result
  }, [completedGame, gameResults])

  const gamePicks = useMemo(() => {
    if (!completedGame) return []
    return currentPicks.filter((p) => p.gameId === completedGame.id)
  }, [completedGame, currentPicks])

  const gameScores = useMemo(() => {
    if (!completedGame) return new Map<string, number>()
    return gameUserScores.get(completedGame.id) || new Map<string, number>()
  }, [completedGame, gameUserScores])

  // We need roster data - for now, we'll need to fetch it or pass it
  // For the results page, we can make a simplified version that doesn't require full roster
  const [roster, setRoster] = React.useState<Player[]>([])

  React.useEffect(() => {
    async function fetchRoster() {
      try {
        const response = await fetch('/api/nhl/roster?team=DET')
        if (response.ok) {
          const rosterData = await response.json()
          setRoster(rosterData.players || [])
        }
      } catch (error) {
        console.error('Error fetching roster:', error)
      }
    }
    fetchRoster()
  }, [])

  // Recalculate user scores from game result to ensure accuracy
  // This ensures all users who made picks are shown with correct points
  const recalculatedScores = useMemo(() => {
    if (!gameResult || !completedGame || gamePicks.length === 0) {
      return new Map<string, number>()
    }
    // Use the calculateUserScores function to get accurate scores
    return calculateUserScores(gamePicks, gameResult, roster, completedGame)
  }, [gameResult, completedGame, gamePicks, roster])

  // Debug logging - only log if there's an issue
  React.useEffect(() => {
    if (gameResult && (!gameResult.playerStats || gameResult.playerStats.length === 0)) {
      console.error('[RESULTS] ERROR: Game result has no player stats!', {
        gameId: gameResult.gameId,
        gameResultKeys: Object.keys(gameResult),
        hasPlayerStats: !!gameResult.playerStats,
        playerStatsLength: gameResult.playerStats?.length || 0,
        playerStatsType: typeof gameResult.playerStats,
        rosterSize: roster.length,
        gameResultsLength: gameResults.length,
        allGameResultIds: gameResults.map(r => r.gameId),
      })
      
      // If we have a gameResult but no playerStats, it might be corrupted data
      // Log the full structure for debugging
      console.error('[RESULTS] Full gameResult structure:', JSON.stringify(gameResult, null, 2))
    }
  }, [gameResult, roster, gameResults])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading results...</p>
        </div>
      </div>
    )
  }

  if (!completedGame || !gameResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
            <p className="text-gray-300 text-lg mb-2">No completed games found.</p>
            <p className="text-gray-400 text-sm mb-4">
              Current game: {currentGame ? `${currentGame.opponent} (${currentGame.status})` : 'None'}<br />
              Game results: {gameResults.length}<br />
              Check browser console for details.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 mx-auto"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Calculate user scores for this game
  interface UserGameScore {
    userId: string
    userName: string
    points: number
    pickType: 'player' | 'team'
    pickName: string
    seasonTotal: number
  }

  // Calculate user scores for this game - show ALL users who made picks
  const userGameScores: UserGameScore[] = gamePicks.map((pick) => {
    const user = users.find((u) => u.id === pick.userId)
    // Use recalculated scores, fallback to gameScores, then calculate on the fly
    let points = recalculatedScores.get(pick.userId) || gameScores.get(pick.userId) || 0
    let pickName = ''
    let pickType: 'player' | 'team' = 'player'

    if (pick.playerId === 'team') {
      pickName = 'The Team'
      pickType = 'team'
      // Calculate team points if not already calculated
      if (points === 0 && completedGame) {
        points = completedGame.teamGoals > 3 ? completedGame.teamGoals : 0
      }
    } else {
      const player = roster.find((p) => p.id === pick.playerId)
      pickName = player ? `#${player.number} ${player.name}` : 'Unknown Player'
      
      // Calculate player points from gameResult if not already calculated
      if (points === 0 && gameResult) {
        const playerStats = gameResult.playerStats.find((s) => s.playerId === pick.playerId)
        if (playerStats) {
          points = calculatePlayerScore(playerStats, completedGame)
        }
      }
    }

    return {
      userId: pick.userId,
      userName: user?.name || 'Unknown',
      points,
      pickType,
      pickName,
      seasonTotal: userScores.get(pick.userId) || 0,
    }
  })

  // Sort by points (descending)
  userGameScores.sort((a, b) => b.points - a.points)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <TrophyIcon className="h-8 w-8 text-yellow-400" />
            <h1 className="text-3xl font-bold text-white">Game Results</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl font-semibold bg-gray-600 hover:bg-gray-700 text-white shadow-lg transition-all flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Dashboard
          </button>
        </div>

        {/* Final Score */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Red Wings</p>
              <p className="text-5xl font-bold text-white">{completedGame.teamGoals}</p>
            </div>
            <div className="text-3xl font-bold text-gray-400">vs</div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">{completedGame.opponent}</p>
              <p className="text-5xl font-bold text-white">{completedGame.opponentGoals}</p>
            </div>
          </div>
          {completedGame.wentToOT && (
            <div className="mt-4 text-center">
              <span className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-full text-sm font-medium">
                {completedGame.shootoutOccurred ? 'Shootout' : 'Overtime'}
              </span>
            </div>
          )}
        </div>

        {/* Primary Section: Points Breakdown Per User */}
        <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center gap-3 mb-6">
            <TargetIcon className="h-6 w-6 text-red-400" />
            <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
              Points Breakdown
            </h2>
          </div>

          <div className="space-y-4">
            {userGameScores.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No picks found for this game.</p>
              </div>
            ) : (
              userGameScores.map((score, index) => {
                const isWinner = index === 0 && score.points > 0

              return (
                <div
                  key={score.userId}
                  className={`backdrop-blur-xl p-6 rounded-2xl border transition-all ${
                    isWinner
                      ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6 flex-1">
                      <div className="flex flex-col items-center justify-center min-w-[4rem]">
                        <div
                          className={`text-4xl font-bold ${
                            isWinner ? 'text-yellow-400' : 'text-white'
                          }`}
                        >
                          {score.points}
                        </div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">pts</div>
                        {isWinner && (
                          <div className="mt-2">
                            <TrophyIcon className="h-5 w-5 text-yellow-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-white text-lg">{score.userName}</p>
                          {isWinner && (
                            <span className="px-2 py-1 bg-yellow-500/30 text-yellow-200 rounded-full text-xs font-medium">
                              Winner
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          Picked: <span className="text-white font-medium">{score.pickName}</span>
                          {score.pickType === 'team' && (
                            <span className="ml-2 text-xs bg-blue-500/30 px-2 py-0.5 rounded-full">
                              Team
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-400 mb-1">Season Total</p>
                      <p className="text-2xl font-bold text-red-300">{score.seasonTotal}</p>
                    </div>
                  </div>
                </div>
              )
            }))}
          </div>
        </div>

        {/* Secondary Section: Full Game Stats Breakdown */}
        <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <TargetIcon className="h-6 w-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
              Player Stats
            </h2>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {!gameResult.playerStats || gameResult.playerStats.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No player stats available for this game.</p>
                <p className="text-sm mt-2">Player stats: {gameResult?.playerStats?.length || 0}, Roster: {roster.length}</p>
              </div>
            ) : gameResult.playerStats
              .map((stats) => {
                const player = roster.find((p) => {
                  // Try multiple matching strategies
                  if (p.id === stats.playerId) return true
                  // Try matching by NHL player ID
                  const nhlId = (p as Player & { playerId?: number }).playerId
                  if (nhlId && String(nhlId) === String(stats.playerId)) return true
                  return false
                })
                
                // If player not found in roster, create a minimal player object from the stats
                if (!player) {
                  // Try to find player name from stats if available
                  const playerName = stats.playerId || 'Unknown Player'
                  const fallbackPlayer: Player = {
                    id: stats.playerId,
                    name: playerName,
                    number: '',
                    position: stats.position || 'F',
                  }
                  return { stats, player: fallbackPlayer, points: calculatePlayerScore(stats, completedGame) }
                }
                
                return { stats, player, points: calculatePlayerScore(stats, completedGame) }
              })
              .filter(Boolean)
              .sort((a, b) => {
                // Sort by points descending, then by goals, then by assists
                if (b!.points !== a!.points) return b!.points - a!.points
                if (b!.stats.goals.length !== a!.stats.goals.length) return b!.stats.goals.length - a!.stats.goals.length
                return b!.stats.assists.length - a!.stats.assists.length
              })
              .map((item) => {
                if (!item) return null
                const { stats, player, points } = item as { stats: typeof gameResult.playerStats[0], player: Player, points: number }
                const goalCount = stats.goals.length
                const assistCount = stats.assists.length
                const shorthandedGoals = stats.goals.filter((g) => g.isShorthanded).length
                const otGoals = stats.goals.filter((g) => g.isOTGoal).length
                const shorthandedAssists = stats.assists.filter((a) => a.isShorthanded).length
                const hasStats = goalCount > 0 || assistCount > 0

                return (
                  <div
                    key={stats.playerId}
                    className={`bg-white/5 p-5 rounded-2xl border transition-all ${
                      hasStats 
                        ? 'border-white/10' 
                        : 'border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-semibold text-lg ${
                          hasStats ? 'text-white' : 'text-gray-400'
                        }`}>
                          #{player.number} {player.name}
                        </p>
                        <p className="text-gray-400 text-sm">{player.position}</p>
                      </div>
                      <div className="flex gap-6 text-center">
                        <div>
                          <p className={`font-bold text-lg ${
                            goalCount > 0 ? 'text-white' : 'text-gray-500'
                          }`}>
                            {goalCount}G
                          </p>
                          {goalCount > 0 && (
                            <div className="flex gap-2 justify-center mt-1">
                              {shorthandedGoals > 0 && (
                                <span className="text-xs text-blue-400">{shorthandedGoals} SH</span>
                              )}
                              {otGoals > 0 && (
                                <span className="text-xs text-orange-400">{otGoals} OT</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${
                            assistCount > 0 ? 'text-white' : 'text-gray-500'
                          }`}>
                            {assistCount}A
                          </p>
                          {assistCount > 0 && shorthandedAssists > 0 && (
                            <p className="text-xs text-blue-400 mt-1">{shorthandedAssists} SH</p>
                          )}
                        </div>
                        <div>
                          <p className={`font-bold text-xl ${
                            points > 0 ? 'text-red-300' : 'text-gray-500'
                          }`}>
                            {points} PTS
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
              .filter(Boolean)}
          </div>
        </div>
      </div>
    </div>
  )
}

