"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"

export default function Home() {
  const router = useRouter()
  const { currentUser, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.push("/dashboard")
      } else {
        // Stay on home page if not logged in (or redirect to login if you add that)
      }
    }
  }, [currentUser, loading, router])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent mb-4">
          Light The Lamp
        </h1>
        <p className="text-gray-300 text-xl mb-8">Detroit Red Wings Pick 'Em</p>
        {currentUser && (
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/20"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  )
}
