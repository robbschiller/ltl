"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { NextGame } from "@/components/dashboard/NextGame"
import { LeagueMembers } from "@/components/dashboard/LeagueMembers"

interface User {
  id: string
  email: string
  name?: string
}

interface DashboardData {
  league: {
    id: string
    name: string
    code: string
    seasonYear: number
  } | null
  members: Array<{
    userId: string
    displayName: string
    hasPicked: boolean
    pick?: {
      playerId: string
      playerName: string
      playerNumber: number | null
    }
    rank: number
    totalPoints: number
  }>
  nextGame: {
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
  } | null
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check auth
        const authResponse = await fetch("/api/auth/me")
        if (!authResponse.ok) {
          router.push("/login")
          return
        }
        const userData = await authResponse.json()
        setUser(userData.user)

        // Fetch dashboard data
        const dashboardResponse = await fetch("/api/dashboard")
        if (dashboardResponse.ok) {
          const data = await dashboardResponse.json()
          setDashboardData(data)
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handlePickUpdate = async () => {
    // Refresh dashboard data after pick update
    try {
      const response = await fetch("/api/dashboard")
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      }
    } catch (error) {
      console.error("Error refreshing dashboard:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-red-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4">
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
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent">
                Light The Lamp
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                Welcome, {user.name || user.email}
              </div>
              <button
                onClick={() => router.push("/leagues")}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all border border-white/20"
              >
                My Leagues
              </button>
              <button
                onClick={handleSignOut}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-red-500/30"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="space-y-8">
          {dashboardData?.league ? (
            <>
              {/* League Header */}
              <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{dashboardData.league.name}</h2>
                    <p className="text-gray-400">Season {dashboardData.league.seasonYear}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">League Code</p>
                    <p className="text-2xl font-mono tracking-widest text-white">{dashboardData.league.code}</p>
                  </div>
                </div>
              </div>

              {/* Next Game - Prominent */}
              <div className="mb-8">
                <NextGame
                  game={dashboardData.nextGame}
                  leagueId={dashboardData.league.id}
                  onPickUpdate={handlePickUpdate}
                />
              </div>

              {/* League Members */}
              <div className="mb-8">
                <LeagueMembers
                  members={dashboardData.members.map((member) => ({
                    ...member,
                    isCurrentUser: member.userId === user.id
                  }))}
                  nextGame={dashboardData.nextGame ? {
                    id: dashboardData.nextGame.id,
                    isLocked: dashboardData.nextGame.isLocked
                  } : undefined}
                />
              </div>
            </>
          ) : (
            /* No League State */
            <div className="backdrop-blur-xl bg-white/5 p-12 rounded-3xl border border-white/10 shadow-2xl text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Welcome to Light The Lamp!</h2>
              <p className="text-gray-300 mb-8 text-lg">
                Get started by joining or creating a league to compete with friends.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => router.push("/league/create")}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg shadow-red-500/30"
                >
                  Create League
                </button>
                <button
                  onClick={() => router.push("/league/join")}
                  className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-medium transition-all border border-white/20"
                >
                  Join League
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
