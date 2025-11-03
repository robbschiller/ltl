"use client"

import { CalendarIcon, MapPinIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Game {
  id: string
  opponent: string
  gameDate: string
  isHome: boolean
  status: string
  homeScore: number | null
  awayScore: number | null
  picks?: Array<{
    id: string
    playerName: string
    player: {
      name: string
      number: number | null
    }
    league: {
      id: string
      name: string
    }
  }>
}

export function UpcomingGames() {
  const router = useRouter()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games?status=upcoming&limit=6')
      if (response.ok) {
        const data = await response.json()
        setGames(data.games || [])
      }
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGameClick = (game: Game) => {
    // Navigate to game page with first league from picks, or prompt to select league
    if (game.picks && game.picks.length > 0) {
      const leagueId = game.picks[0].league.id
      router.push(`/game/${game.id}?leagueId=${leagueId}`)
    } else {
      // If no picks, navigate to leagues page to select a league
      router.push(`/leagues`)
    }
  }

  const formatGameDate = (gameDate: string) => {
    const date = new Date(gameDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const gameDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (gameDay.getTime() === today.getTime()) {
      return { date: 'Today', time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) }
    } else if (gameDay.getTime() === tomorrow.getTime()) {
      return { date: 'Tomorrow', time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) }
    } else {
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      }
    }
  }

  const getOpponentLogo = (opponent: string) => {
    // Placeholder - in production, store team logos in database or use team abbreviation mapping
    return 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Tampa_Bay_Lightning_Logo_2011.svg/1200px-Tampa_Bay_Lightning_Logo_2011.svg.png'
  }

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Games</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading games...</p>
        </div>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Games</h2>
        <div className="text-center py-8">
          <p className="text-gray-400">No upcoming games scheduled.</p>
          <p className="text-sm text-gray-500 mt-2">Sync games from NHL API to see upcoming games.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Upcoming Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {games.map((game, index) => {
          const dateInfo = formatGameDate(game.gameDate)
          const isFirstUpcoming = index === 0 && game.status === 'scheduled'
          
          return (
            <div
              key={game.id}
              onClick={() => handleGameClick(game)}
              className={`backdrop-blur-xl p-4 rounded-2xl border transition-all ${isFirstUpcoming ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20 scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-red-500/30'} group cursor-pointer`}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex items-center space-x-3">
                  <Image
                    src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Detroit_Red_Wings_logo.svg/1200px-Detroit_Red_Wings_logo.svg.png"
                    alt="Red Wings"
                    width={48}
                    height={48}
                  />
                  <span className="text-white font-semibold">vs</span>
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                    <p className="text-white font-bold text-xs">{game.opponent.charAt(0)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold">{game.opponent}</p>
                  <div className="flex items-center justify-center text-gray-400 text-sm mt-2">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {dateInfo.date} • {dateInfo.time}
                  </div>
                  <div className="flex items-center justify-center text-gray-400 text-sm mt-1">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    {game.isHome ? 'Little Caesars Arena' : `${game.opponent} Arena`}
                  </div>
                  <span
                    className={`mt-3 inline-block px-3 py-1 text-xs rounded-full ${game.isHome ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'bg-white/10 text-gray-300 border border-white/20'}`}
                  >
                    {game.isHome ? 'Home' : 'Away'}
                  </span>
                  {game.picks && game.picks.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {game.picks.length} pick{game.picks.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

