"use client"

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { InfoIcon, X } from 'lucide-react'

export function Navbar() {
  const { currentUser, signOut } = useAuth()
  const router = useRouter()
  const [showScoringRules, setShowScoringRules] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowScoringRules(false)
      }
    }

    if (showScoringRules) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showScoringRules])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-r from-gray-900/80 via-gray-800/80 to-red-950/80 border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex-shrink-0 flex items-center group">
              <Image
                className="h-10 w-auto transition-transform group-hover:scale-110"
                src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Detroit_Red_Wings_logo.svg/1200px-Detroit_Red_Wings_logo.svg.png"
                alt="Red Wings Logo"
                width={40}
                height={40}
              />
            </Link>

            {currentUser && (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/results/past"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Past Results
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center">
            {currentUser ? (
              <div className="flex items-center space-x-4 relative">
                <button
                  onClick={() => setShowScoringRules(!showScoringRules)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
                  title="View scoring rules"
                >
                  <InfoIcon className="h-5 w-5" />
                </button>
                
                {showScoringRules && (
                  <div
                    ref={popupRef}
                    className="absolute top-12 right-0 w-96 max-w-[calc(100vw-2rem)] backdrop-blur-xl bg-gray-900/95 border border-white/20 rounded-2xl shadow-2xl p-6 z-50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">Scoring Rules</h3>
                      <button
                        onClick={() => setShowScoringRules(false)}
                        className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                      <div className="border-l-4 border-red-500 pl-4">
                        <h4 className="font-semibold text-white mb-2">Goalies (G)</h4>
                        <ul className="space-y-1 text-gray-300">
                          <li>• 5 points for shutout</li>
                          <li>• 3 points for 1-2 goals allowed</li>
                          <li>• 0 points for 3+ goals allowed</li>
                          <li>• 5 points per assist</li>
                          <li className="text-gray-400 italic">Note: Empty netters and shootouts don't count against goalies</li>
                        </ul>
                      </div>
                      
                      <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-semibold text-white mb-2">Forwards (C, LW, RW)</h4>
                        <ul className="space-y-1 text-gray-300">
                          <li>• 2 points per regulation goal</li>
                          <li>• +5 points if OT goal (7 total!)</li>
                          <li>• 1 point per assist</li>
                          <li>• Points doubled if shorthanded</li>
                        </ul>
                      </div>
                      
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-white mb-2">Defensemen (D)</h4>
                        <ul className="space-y-1 text-gray-300">
                          <li>• 3 points per regulation goal</li>
                          <li>• +5 points if OT goal (8 total!)</li>
                          <li>• 1 point per assist</li>
                          <li>• Points doubled if shorthanded</li>
                        </ul>
                      </div>
                      
                      <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-semibold text-white mb-2">The Team</h4>
                        <ul className="space-y-1 text-gray-300">
                          <li>• 1 point per goal past 3</li>
                          <li>• 4 goals = 4 points</li>
                          <li>• 5 goals = 5 points, etc.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-medium hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/20"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-medium hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

