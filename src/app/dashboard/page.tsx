"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useGame } from '@/contexts/GameContext'
import { NextGame } from '@/components/dashboard/NextGame'
import { CurrentGame } from '@/components/dashboard/CurrentGame'
import { PickOrder } from '@/components/dashboard/PickOrder'
import { GameResults } from '@/components/dashboard/GameResults'
import { AdminControls } from '@/components/dashboard/AdminControls'
import { LoaderIcon, TrophyIcon } from 'lucide-react'

interface RosterPlayer {
  id: string
  name: string
  number: string
  position: string
  goals?: number
  assists?: number
  points?: number
  gamesPlayed?: number
}

export default function Dashboard() {
  const router = useRouter()
  const { currentUser, loading: authLoading } = useAuth()
  const {
    currentGame,
    currentPicks,
    latestCompletedGame,
    latestGameResult,
    latestPicks,
    users,
    userScores,
    isLoading,
    picksLocked,
    refreshGameData,
  } = useGame()

  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [isLoadingRoster, setIsLoadingRoster] = useState(true)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login')
    }
  }, [authLoading, currentUser, router])

  // Fetch roster from NHL API
  useEffect(() => {
    async function fetchRoster() {
      try {
        setIsLoadingRoster(true)
        const response = await fetch('/api/nhl/roster?team=DET')
        if (response.ok) {
          const rosterData = await response.json()
          setRoster(rosterData.players || [])
        }
      } catch (error) {
        console.error('Error fetching roster:', error)
      } finally {
        setIsLoadingRoster(false)
      }
    }

    fetchRoster()
  }, [])

  // Check if all users have made picks
  const allPicksMade = Boolean(currentGame && picksLocked)
  const hasGameStarted = useMemo(() => {
    if (!currentGame?.startTimeUTC) return false
    const startTime = new Date(currentGame.startTimeUTC).getTime()
    if (Number.isNaN(startTime)) return false
    return Date.now() >= startTime
  }, [currentGame?.startTimeUTC])
  const showCurrentGameView = Boolean(
    currentGame && picksLocked && hasGameStarted && currentGame.status !== 'completed',
  )

  const handleManualRefresh = async () => {
    await refreshGameData()
  }

  useEffect(() => {
    if (!showCurrentGameView) return

    const intervalId = window.setInterval(() => {
      refreshGameData()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [showCurrentGameView, refreshGameData])


  if (isLoading || !currentGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading game...</p>
        </div>
      </div>
    )
  }

  // Transform current game to NextGame component format
  const nextGameProps = currentGame ? {
    opponent: currentGame.opponent,
    opponentLogo: currentGame.opponentLogo,
    date: currentGame.date,
    time: currentGame.time,
    venue: currentGame.venue,
    isHome: currentGame.isHome,
    status: currentGame.status,
  } : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {currentGame && nextGameProps && <NextGame game={nextGameProps} />}

        {/* Game Controls */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {(currentGame?.status === 'upcoming' || currentGame?.status === 'live') &&
                !showCurrentGameView && (
                <div>
                  <p className="text-white font-semibold mb-1">Ready for Picks?</p>
                  <p className="text-sm text-gray-400">
                    {allPicksMade
                      ? 'All picks are in! Results will finalize when the game ends.'
                      : `${users.length - currentPicks.filter((p) => p.gameId === currentGame?.id).length} pick(s) remaining.`}
                  </p>
                </div>
              )}
              {showCurrentGameView && (
                <div>
                  <p className="text-white font-semibold mb-1">Game in Progress</p>
                  <p className="text-sm text-gray-400">
                    Picks are locked. Scores will post when the game ends.
                  </p>
                </div>
              )}
              {currentGame?.status === 'completed' && (
                <div>
                  <p className="text-white font-semibold mb-1">Game Completed</p>
                  <p className="text-sm text-gray-400">
                    View results below or see the full results page.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {(currentGame?.status === 'upcoming' || currentGame?.status === 'live') && (
                <button
                  onClick={handleManualRefresh}
                  className="px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white shadow-lg shadow-gray-500/20"
                >
                  <LoaderIcon className="h-5 w-5" />
                  Check Results
                </button>
              )}
              {currentGame?.status === 'completed' && (
                <>
                  <button
                    onClick={() => router.push('/results')}
                    className="px-6 py-3 rounded-xl font-semibold bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2"
                  >
                    <TrophyIcon className="h-5 w-5" />
                    View Results
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admin Controls */}
        {currentUser?.isAdmin && currentGame && (
          <AdminControls
            users={users}
            roster={roster}
            currentGameId={currentGame.id}
            onRefresh={refreshGameData}
            userScores={userScores}
            currentUserId={currentUser.uid}
          />
        )}

        {/* Current Game */}
        {showCurrentGameView &&
          (isLoadingRoster ? (
            <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-300">Loading roster...</p>
              </div>
            </div>
          ) : (
            currentGame && (
              <CurrentGame
                game={currentGame}
                picks={currentPicks}
                users={users}
                roster={roster}
              />
            )
          ))}

        {/* Game Results */}
        {latestGameResult && latestCompletedGame && (
          <GameResults
            game={latestCompletedGame}
            gameResult={latestGameResult}
            picks={latestPicks}
            roster={roster}
            users={users}
            userScores={userScores}
          />
        )}

        {/* Pick Order */}
        {!showCurrentGameView &&
          (isLoadingRoster ? (
            <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-300">Loading roster...</p>
              </div>
            </div>
          ) : (
            <PickOrder currentUserId={currentUser?.uid || ''} roster={roster} />
          ))}
      </div>
    </div>
  )
}
