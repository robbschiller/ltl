"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Image from "next/image"
import { CalendarIcon, MapPinIcon, LockIcon, CheckIcon } from "lucide-react"
import { PlayerSelector } from "@/components/game/PlayerSelector"

interface Game {
  id: string
  opponent: string
  gameDate: string
  isHome: boolean
  status: string
  homeScore: number | null
  awayScore: number | null
}

interface Player {
  id: string
  name: string
  number: number | null
  position: string
  isActive: boolean
}

interface Pick {
  id: string
  playerId: string
  playerName: string
  player: Player
  pointsEarned: number
  lockedAt: string | null
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface League {
  id: string
  name: string
  code: string
}

interface CurrentUser {
  id: string
  email: string
  name?: string | null
}

export default function GameDetailPage() {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [pick, setPick] = useState<Pick | null>(null)
  const [allPicks, setAllPicks] = useState<Pick[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (params?.id) {
      fetchGameData()
    }
  }, [params])

  const fetchGameData = async () => {
    try {
      // Get current user
      const userResponse = await fetch("/api/auth/me")
      if (!userResponse.ok) {
        router.push("/login")
        return
      }
      const userData = await userResponse.json()
      setCurrentUser(userData.user)

      const gameId = params?.id as string
      const leagueId = searchParams?.get("leagueId")

      if (!leagueId) {
        setError("League ID is required")
        setLoading(false)
        return
      }

      // Fetch game
      const gameResponse = await fetch(`/api/game/${gameId}`)
      if (!gameResponse.ok) {
        setError("Game not found")
        setLoading(false)
        return
      }
      const gameData = await gameResponse.json()
      setGame(gameData.game)

      // Fetch league
      const leagueResponse = await fetch(`/api/league/${leagueId}`)
      if (!leagueResponse.ok) {
        setError("League not found")
        setLoading(false)
        return
      }
      const leagueData = await leagueResponse.json()
      setLeague(leagueData.league)

      // Fetch players (refresh from NHL API to get current roster)
      const playersResponse = await fetch("/api/players?refresh=true")
      if (playersResponse.ok) {
        const playersData = await playersResponse.json()
        setPlayers(playersData.players || [])
      }

      // Fetch user's existing pick
      const pickResponse = await fetch(
        `/api/pick/user/game?gameId=${gameId}&leagueId=${leagueId}`
      )
      if (pickResponse.ok) {
        const pickData = await pickResponse.json()
        if (pickData.pick) {
          setPick(pickData.pick)
          setSelectedPlayer(pickData.pick.player)
        }
      }

      // Fetch all picks for this game/league
      const allPicksResponse = await fetch(
        `/api/pick/game/${gameId}?leagueId=${leagueId}`
      )
      if (allPicksResponse.ok) {
        const allPicksData = await allPicksResponse.json()
        setAllPicks(allPicksData.picks || [])
      }
    } catch (error) {
      console.error("Error fetching game data:", error)
      setError("Failed to load game data")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlayer = (player: Player) => {
    if (isPickLocked()) {
      return
    }
    setSelectedPlayer(player)
    setError(null)
    setSuccess(null)
  }

  const handleSubmitPick = async () => {
    if (!selectedPlayer || !game || !league) {
      setError("Please select a player")
      return
    }

    if (isPickLocked()) {
      setError("Picks are locked for this game")
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/pick/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueId: league.id,
          gameId: game.id,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to create pick")
        return
      }

      setSuccess("Pick submitted successfully!")
      setPick(data.pick)

      // Refresh all pick data
      setTimeout(() => {
        fetchGameData()
      }, 1000)
    } catch (error) {
      console.error("Error submitting pick:", error)
      setError("Failed to submit pick. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const isPickLocked = (): boolean => {
    if (!game) return true

    // Check if game has started or is final
    if (game.status !== "scheduled") {
      return true
    }

    // Check if pick is locked (30 minutes before game)
    const gameStartTime = new Date(game.gameDate)
    const lockTime = new Date(gameStartTime.getTime() - 30 * 60 * 1000)
    const now = new Date()

    return now >= lockTime || !!pick?.lockedAt
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!game || !league) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">
            {error || "Game or league not found"}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const locked = isPickLocked()
  const gameDate = new Date(game.gameDate)
  const lockTime = new Date(gameDate.getTime() - 30 * 60 * 1000)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-center backdrop-blur-xl bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="flex items-center space-x-4">
              <Image
                src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Detroit_Red_Wings_logo.svg/1200px-Detroit_Red_Wings_logo.svg.png"
                alt="Red Wings Logo"
                width={40}
                height={40}
              />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent">
                  Make Your Pick
                </h1>
                <p className="text-sm text-gray-400">{league.name}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/league/${league.id}`)}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              ← Back to League
            </button>
          </div>
        </header>

        {/* Game Info */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
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
              <span className="text-2xl font-bold text-white">vs</span>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                  <p className="text-white font-bold">{game.opponent.charAt(0)}</p>
                </div>
                <p className="text-white font-semibold mt-2">{game.opponent}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center text-gray-300">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {gameDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {" • "}
                {gameDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="flex items-center justify-center text-gray-400 text-sm">
                <MapPinIcon className="h-4 w-4 mr-2" />
                {game.isHome ? "Little Caesars Arena" : game.opponent + " Arena"}
              </div>
              {locked && (
                <div className="flex items-center justify-center text-red-400 text-sm">
                  <LockIcon className="h-4 w-4 mr-2" />
                  Picks are locked for this game
                  {pick?.lockedAt && (
                    <span className="ml-2">
                      (Locked at {new Date(pick.lockedAt).toLocaleString()})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Picks Display */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">League Picks</h2>
          
          {allPicks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No picks submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPicks.map((leaguePick) => {
                const isCurrentUser = leaguePick.user.id === currentUser?.id
                return (
                  <div
                    key={leaguePick.id}
                    className={`p-4 rounded-xl border ${
                      isCurrentUser
                        ? "bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/20"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <p className="font-semibold text-white">
                            {leaguePick.user.name || leaguePick.user.email}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs bg-red-500/20 text-red-200 px-2 py-1 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-lg text-white">
                          {leaguePick.playerName} #{leaguePick.player?.number || "N/A"}
                        </p>
                        <p className="text-sm text-gray-400">
                          {leaguePick.player?.position}
                        </p>
                      </div>
                      <div className="text-right">
                        {leaguePick.pointsEarned > 0 ? (
                          <div>
                            <p className="text-sm text-gray-400">Points</p>
                            <p className="text-2xl font-bold text-yellow-400">
                              {leaguePick.pointsEarned}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-gray-400">Status</p>
                            <p className="text-sm font-semibold text-gray-300">
                              {game.status === "final" ? "Game Final" : "Awaiting Results"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Player Selection - Always Show */}
        <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Red Wings Roster</h2>
            {pick && (
              <div className="text-sm text-gray-400">
                {locked ? "Picks Locked" : "Pick Submitted"}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-200 flex items-center">
              <CheckIcon className="h-5 w-5 mr-2" />
              {success}
            </div>
          )}

          {pick && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-gray-300">
                Your pick: <span className="font-semibold text-white">{pick.playerName} #{pick.player?.number || "N/A"}</span>
              </p>
              {locked && (
                <p className="text-sm text-gray-500 mt-1">Picks are locked for this game.</p>
              )}
            </div>
          )}

          {!pick && (
            <>
              <PlayerSelector
                players={players}
                selectedPlayerId={selectedPlayer?.id || null}
                onSelectPlayer={handleSelectPlayer}
                disabled={locked}
              />

              {selectedPlayer && !locked && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSubmitPick}
                    disabled={submitting || locked}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit Pick"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Always show roster for viewing */}
          {pick && (
            <div className="mt-6">
              <PlayerSelector
                players={players}
                selectedPlayerId={pick.player?.id || null}
                onSelectPlayer={() => {}} // No-op when viewing
                disabled={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

