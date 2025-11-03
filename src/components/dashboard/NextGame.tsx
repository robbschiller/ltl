"use client"

import { CalendarIcon, MapPinIcon, LockIcon, ClockIcon, CheckIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface NextGame {
  id: string
  opponent: string
  gameDate: string
  isHome: boolean
  status: string
  isLocked: boolean
  lockTime: string
  userPick?: {
    playerId: string
    playerName: string
    playerNumber: number | null
  }
}

interface NextGameProps {
  game: NextGame | null
  leagueId: string
  onPickUpdate?: () => void
}

export function NextGame({ game, leagueId, onPickUpdate }: NextGameProps) {
  const router = useRouter()
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [hasPicked, setHasPicked] = useState(!!game?.userPick)

  useEffect(() => {
    if (game?.lockTime && !game.isLocked) {
      const updateTimeRemaining = () => {
        const lockTime = new Date(game.lockTime)
        const now = new Date()
        const diff = lockTime.getTime() - now.getTime()

        if (diff <= 0) {
          setTimeRemaining("Locked")
          return
        }

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`)
        } else {
          setTimeRemaining(`${seconds}s`)
        }
      }

      updateTimeRemaining()
      const interval = setInterval(updateTimeRemaining, 1000)

      return () => clearInterval(interval)
    }
  }, [game?.lockTime, game?.isLocked])

  useEffect(() => {
    setHasPicked(!!game?.userPick)
  }, [game?.userPick])

  if (!game) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Next Game</h2>
        <div className="text-center py-8">
          <p className="text-gray-400">No upcoming games scheduled.</p>
          <p className="text-sm text-gray-500 mt-2">Sync games from NHL API to see upcoming games.</p>
        </div>
      </div>
    )
  }

  const gameDate = new Date(game.gameDate)
  const lockTime = new Date(game.lockTime)
  const now = new Date()
  const formattedDate = gameDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const formattedTime = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  const handleMakePick = () => {
    router.push(`/game/${game.id}?leagueId=${leagueId}`)
  }

  const isPickable = !game.isLocked && game.status === "scheduled"

  return (
    <div
      className={`backdrop-blur-xl p-6 rounded-3xl border shadow-2xl ${
        !hasPicked && isPickable
          ? "bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20"
          : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Next Game</h2>
        {!game.isLocked && game.status === "scheduled" && (
          <div className="flex items-center space-x-2 text-sm text-yellow-300">
            <ClockIcon className="h-4 w-4" />
            <span>{timeRemaining || "Calculating..."}</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Game Info */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex flex-col items-center">
              <Image
                src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Detroit_Red_Wings_logo.svg/1200px-Detroit_Red_Wings_logo.svg.png"
                alt="Red Wings"
                width={64}
                height={64}
              />
              <p className="text-white font-semibold mt-2">Detroit Red Wings</p>
            </div>
            <span className="text-3xl font-bold text-white">vs</span>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                <p className="text-white font-bold text-lg">{game.opponent.charAt(0)}</p>
              </div>
              <p className="text-white font-semibold mt-2">{game.opponent}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center text-gray-300">
              <CalendarIcon className="h-4 w-4 mr-2" />
              {formattedDate} • {formattedTime}
            </div>
            <div className="flex items-center justify-center text-gray-400 text-sm">
              <MapPinIcon className="h-4 w-4 mr-2" />
              {game.isHome ? "Little Caesars Arena" : `${game.opponent} Arena`}
            </div>
            <span
              className={`inline-block px-3 py-1 text-xs rounded-full ${
                game.isHome
                  ? "bg-red-500/20 text-red-200 border border-red-500/30"
                  : "bg-white/10 text-gray-300 border border-white/20"
              }`}
            >
              {game.isHome ? "Home" : "Away"}
            </span>
          </div>
        </div>

        {/* User's Pick */}
        {hasPicked && game.userPick && (
          <div className="backdrop-blur-xl bg-green-500/10 p-4 rounded-2xl border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Your Pick</p>
                <p className="text-xl font-bold text-white">
                  {game.userPick.playerName}
                  {game.userPick.playerNumber && ` #${game.userPick.playerNumber}`}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-300 border border-green-500/50">
                <CheckIcon className="h-6 w-6" />
              </div>
            </div>
          </div>
        )}

        {/* Lock Status */}
        {game.isLocked && (
          <div className="backdrop-blur-xl bg-gray-500/10 p-4 rounded-2xl border border-gray-500/30">
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <LockIcon className="h-5 w-5" />
              <span>Picks are locked for this game</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          {isPickable && !hasPicked && (
            <button
              onClick={handleMakePick}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-red-500/30"
            >
              Make Your Pick
            </button>
          )}
          {isPickable && hasPicked && (
            <button
              onClick={handleMakePick}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-all border border-white/20"
            >
              View/Edit Pick
            </button>
          )}
          <button
            onClick={() => router.push(`/game/${game.id}?leagueId=${leagueId}`)}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-all border border-white/20"
          >
            View Game
          </button>
        </div>
      </div>
    </div>
  )
}

