"use client"

import { TrophyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  points: number
  totalPicks: number
  completedPicks: number
  isCurrentUser?: boolean
}

interface LeaderboardData {
  league: {
    id: string
    name: string
    seasonYear: number
  } | null
  leaderboard: LeaderboardEntry[]
}

export function Leaderboard({ currentUserId, leagueId }: { currentUserId: string; leagueId?: string }) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchLeaderboard()
  }, [leagueId])

  const fetchLeaderboard = async () => {
    try {
      const url = leagueId 
        ? `/api/leaderboard?leagueId=${leagueId}`
        : '/api/leaderboard'
      
      const response = await fetch(url)
      if (response.ok) {
        const leaderboardData = await response.json()
        setData(leaderboardData)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <TrophyIcon className="h-7 w-7 mr-2 text-yellow-400" />
          League Rankings
        </h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <TrophyIcon className="h-7 w-7 mr-2 text-yellow-400" />
          League Rankings
        </h2>
        <div className="text-center py-8">
          <p className="text-gray-400">No leaderboard data available.</p>
          <p className="text-sm text-gray-500 mt-2">Join a league and make picks to see rankings.</p>
        </div>
      </div>
    )
  }

  const leaderboardData = data.leaderboard

  return (
    <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <TrophyIcon className="h-7 w-7 mr-2 text-yellow-400" />
          {data.league ? data.league.name : 'Overall'} Rankings
        </h2>
        {data.league && (
          <span className="text-sm text-gray-400">Season {data.league.seasonYear}</span>
        )}
      </div>
      <div className="space-y-3">
        {leaderboardData.map((entry) => (
          <div
            key={entry.userId}
            className={`backdrop-blur-xl p-4 rounded-2xl border transition-all ${entry.isCurrentUser ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-500/50' : entry.rank === 2 ? 'bg-gray-400/20 text-gray-300 border-2 border-gray-400/50' : entry.rank === 3 ? 'bg-orange-600/20 text-orange-300 border-2 border-orange-600/50' : 'bg-white/10 text-gray-300'}`}
                >
                  {entry.rank}
                </div>
                <div>
                  <p
                    className={`font-semibold ${entry.isCurrentUser ? 'text-white' : 'text-gray-200'}`}
                  >
                    {entry.displayName}
                    {entry.isCurrentUser && (
                      <span className="ml-2 text-xs bg-red-500/30 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    {entry.completedPicks}/{entry.totalPicks} picks completed
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {entry.points}
                </p>
                <p className="text-xs text-gray-400">points</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

