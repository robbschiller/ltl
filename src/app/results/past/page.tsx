"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface PastGame {
  id: string
  opponent: string
  opponentLogo: string
  date: string
  time: string
  teamGoals: number
  opponentGoals: number
  wentToOT: boolean
  shootoutOccurred: boolean
}

export default function PastResultsPage() {
  const router = useRouter()
  const { currentUser, loading: authLoading } = useAuth()
  const [games, setGames] = useState<PastGame[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login')
      return
    }
  }, [authLoading, currentUser, router])

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/game/history')
        if (response.ok) {
          const data = await response.json()
          setGames(data.games || [])
        }
      } catch (error) {
        console.error('Error fetching past games:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading past results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-6">Past Results</h1>
        <div className="space-y-4">
          {games.length === 0 ? (
            <div className="backdrop-blur-xl bg-white/5 p-6 rounded-2xl border border-white/10 text-gray-300">
              No completed games found yet.
            </div>
          ) : (
            games.map((game) => (
              <button
                key={game.id}
                onClick={() => router.push(`/results/past/${game.id}`)}
                className="w-full text-left backdrop-blur-xl bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">
                      Red Wings vs {game.opponent}
                    </p>
                    <p className="text-sm text-gray-400">
                      {game.date} • {game.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-lg font-bold">
                      {game.teamGoals} - {game.opponentGoals}
                    </p>
                    {game.wentToOT && (
                      <span className="text-xs text-orange-300">
                        {game.shootoutOccurred ? 'SO' : 'OT'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
