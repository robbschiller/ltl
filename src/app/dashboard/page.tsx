"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useGame } from '@/contexts/GameContext'
import { NextGame } from '@/components/dashboard/NextGame'
import { PickOrder } from '@/components/dashboard/PickOrder'
import { GameResults } from '@/components/dashboard/GameResults'
import { PlayIcon, ArrowRightIcon, LoaderIcon, TrophyIcon } from 'lucide-react'

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
  const { currentUser } = useAuth()
  const {
    currentGame,
    currentPicks,
    gameResults,
    users,
    userScores,
    isLoading,
    simulateCurrentGame,
    startNextGame,
  } = useGame()

  const [isSimulating, setIsSimulating] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [isLoadingRoster, setIsLoadingRoster] = useState(true)
  const [nhlGame, setNhlGame] = useState<any>(null)
  const [isLoadingGame, setIsLoadingGame] = useState(true)

  // Fetch tonight's game from NHL API
  useEffect(() => {
    async function fetchGame() {
      try {
        setIsLoadingGame(true)
        const response = await fetch('/api/nhl/game')
        if (response.ok) {
          const gameData = await response.json()
          setNhlGame(gameData)
          
          // Update GameContext with real NHL game data if currentGame doesn't match
          if (!currentGame || currentGame.id !== gameData.id) {
            startNextGame(
              gameData.opponent,
              gameData.opponentLogo,
              gameData.date,
              gameData.time,
              gameData.venue,
              gameData.isHome,
              gameData.nhlGameData,
            )
          }
        }
      } catch (error) {
        console.error('Error fetching NHL game:', error)
      } finally {
        setIsLoadingGame(false)
      }
    }

    fetchGame()
  }, [currentGame, startNextGame])

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

  // Use NHL game data if available, otherwise fall back to currentGame
  const displayGame = nhlGame || currentGame

  // Check if all users have made picks
  const allPicksMade =
    currentGame &&
    users.every((user) =>
      currentPicks.some((pick) => pick.userId === user.id && pick.gameId === currentGame.id),
    )

  const handleSimulateGame = async () => {
    if (!currentGame || !allPicksMade) return

    // Ensure roster is loaded
    if (!roster || roster.length === 0) {
      console.error('Cannot simulate: roster not loaded yet')
      alert('Roster is still loading. Please wait a moment and try again.')
      return
    }

    console.log('Starting simulation with:', {
      rosterSize: roster.length,
      gameId: currentGame.id,
      picksCount: currentPicks.filter((p) => p.gameId === currentGame.id).length,
    })

    setIsSimulating(true)
    // Add a small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 500))
    await simulateCurrentGame(roster)
    setIsSimulating(false)
    
    // Wait a bit for state to update, then navigate to results page
    await new Promise((resolve) => setTimeout(resolve, 300))
    router.push('/results')
  }

  const handleNextGame = () => {
    // For now, just create a new game with a different opponent
    const opponents = [
      {
        name: 'Boston Bruins',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Boston_Bruins.svg/1200px-Boston_Bruins.svg.png',
      },
      {
        name: 'Chicago Blackhawks',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/29/Chicago_Blackhawks_logo.svg/1200px-Chicago_Blackhawks_logo.svg.png',
      },
      {
        name: 'Montreal Canadiens',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Montreal_Canadiens.svg/1200px-Montreal_Canadiens.svg.png',
      },
      {
        name: 'New York Rangers',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/New_York_Rangers.svg/1200px-New_York_Rangers.svg.png',
      },
    ]

    const opponent = opponents[Math.floor(Math.random() * opponents.length)]

    // Start next game (pick order already rotated after previous game completed)
    startNextGame(
      opponent.name,
      opponent.logo,
      'Tonight',
      '7:00 PM EST',
      Math.random() > 0.5 ? 'Little Caesars Arena' : `${opponent.name} Arena`,
      Math.random() > 0.5,
    )
  }

  if (isLoading || isLoadingGame || !displayGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading game...</p>
        </div>
      </div>
    )
  }

  const currentGameResult = currentGame 
    ? gameResults.find((r) => r.gameId === currentGame.id) || null
    : null

  // Transform NHL game data to NextGame component format
  const nextGameProps = nhlGame ? {
    opponent: nhlGame.opponent,
    opponentLogo: nhlGame.opponentLogo,
    date: nhlGame.date,
    time: nhlGame.time,
    venue: nhlGame.venue,
    isHome: nhlGame.isHome,
    status: nhlGame.status,
  } : currentGame ? {
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
        {displayGame && nextGameProps && <NextGame game={nextGameProps} />}

        {/* Game Controls */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {displayGame?.status === 'upcoming' && (
                <div>
                  <p className="text-white font-semibold mb-1">Ready to Simulate?</p>
                  <p className="text-sm text-gray-400">
                    {allPicksMade
                      ? 'All picks are in! Click below to simulate the game.'
                      : `${users.length - (currentPicks.filter((p) => p.gameId === (currentGame?.id || displayGame?.id)).length)} pick(s) remaining.`}
                  </p>
                </div>
              )}
              {displayGame?.status === 'completed' && (
                <div>
                  <p className="text-white font-semibold mb-1">Game Completed</p>
                  <p className="text-sm text-gray-400">
                    View results below or see the full results page.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {displayGame?.status === 'upcoming' && (
                <button
                  onClick={handleSimulateGame}
                  disabled={!allPicksMade || isSimulating}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                    allPicksMade && !isSimulating
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <LoaderIcon className="h-5 w-5 animate-spin" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5" />
                      Simulate Game
                    </>
                  )}
                </button>
              )}
              {displayGame?.status === 'completed' && (
                <>
                  <button
                    onClick={() => router.push('/results')}
                    className="px-6 py-3 rounded-xl font-semibold bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2"
                  >
                    <TrophyIcon className="h-5 w-5" />
                    View Results
                  </button>
                  <button
                    onClick={handleNextGame}
                    className="px-6 py-3 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
                  >
                    Next Game
                    <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Game Results */}
        {currentGameResult && currentGame && (
          <GameResults
            game={currentGame}
            gameResult={currentGameResult}
            picks={currentPicks.filter((p) => p.gameId === currentGame.id)}
            roster={roster}
            users={users}
            userScores={userScores}
          />
        )}

        {/* Pick Order */}
        {isLoadingRoster ? (
          <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading roster...</p>
            </div>
          </div>
        ) : (
          <PickOrder currentUserId={currentUser?.uid || ''} roster={roster} />
        )}
      </div>
    </div>
  )
}

