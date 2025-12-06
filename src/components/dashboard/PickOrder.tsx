"use client"

import React, { useState } from 'react'
import { UserIcon, LockIcon, CheckCircleIcon, ClockIcon } from 'lucide-react'

interface Player {
  id: string
  name: string
  number: string
  position: string
  goals?: number
  assists?: number
  points?: number
}

interface User {
  id: string
  name: string
  pick: string | null
  points: number
}

interface PickOrderProps {
  currentUserId: string
  roster: Player[]
}

export function PickOrder({ currentUserId, roster }: PickOrderProps) {
  const [activeTab, setActiveTab] = useState<'picks' | 'roster'>('picks')

  // Mock users in pick order with season points
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Sarah Johnson',
      pick: '1',
      points: 245,
    },
    {
      id: '2',
      name: 'Mike Williams',
      pick: '2',
      points: 232,
    },
    {
      id: currentUserId,
      name: 'You',
      pick: null,
      points: 218,
    },
    {
      id: '4',
      name: 'Emily Davis',
      pick: null,
      points: 205,
    },
    {
      id: '5',
      name: 'John Smith',
      pick: null,
      points: 198,
    },
    {
      id: '6',
      name: 'Alex Thompson',
      pick: null,
      points: 187,
    },
    {
      id: '7',
      name: 'Rachel Green',
      pick: null,
      points: 175,
    },
    {
      id: '8',
      name: 'Tom Brady',
      pick: null,
      points: 162,
    },
  ])

  const handlePickChange = (userId: string, playerId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              pick: playerId,
            }
          : user,
      ),
    )
  }

  // Find the first user without a pick
  const currentPickerIndex = users.findIndex((user) => user.pick === null)
  const currentPicker = users[currentPickerIndex]

  // Get already picked player IDs
  const pickedPlayerIds = users
    .filter((user) => user.pick !== null)
    .map((user) => user.pick)

  // Filter available roster
  const availableRoster = roster.filter(
    (player) => !pickedPlayerIds.includes(player.id),
  )

  // Enhanced roster with stats
  const rosterWithStats: Player[] = [
    {
      id: '1',
      name: 'Dylan Larkin',
      number: '71',
      position: 'C',
      goals: 28,
      assists: 35,
      points: 63,
    },
    {
      id: '2',
      name: 'Lucas Raymond',
      number: '23',
      position: 'LW',
      goals: 24,
      assists: 38,
      points: 62,
    },
    {
      id: '3',
      name: 'Alex DeBrincat',
      number: '93',
      position: 'RW',
      goals: 32,
      assists: 28,
      points: 60,
    },
    {
      id: '4',
      name: 'Moritz Seider',
      number: '53',
      position: 'D',
      goals: 8,
      assists: 34,
      points: 42,
    },
    {
      id: '5',
      name: 'Patrick Kane',
      number: '88',
      position: 'RW',
      goals: 18,
      assists: 32,
      points: 50,
    },
    {
      id: '6',
      name: 'J.T. Compher',
      number: '18',
      position: 'C',
      goals: 15,
      assists: 22,
      points: 37,
    },
    {
      id: '7',
      name: 'Ben Chiarot',
      number: '8',
      position: 'D',
      goals: 4,
      assists: 18,
      points: 22,
    },
    {
      id: '8',
      name: 'Ville Husso',
      number: '35',
      position: 'G',
      goals: 0,
      assists: 1,
      points: 1,
    },
    {
      id: '9',
      name: 'Andrew Copp',
      number: '82',
      position: 'C',
      goals: 12,
      assists: 19,
      points: 31,
    },
    {
      id: '10',
      name: 'David Perron',
      number: '57',
      position: 'RW',
      goals: 16,
      assists: 24,
      points: 40,
    },
  ]

  return (
    <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('picks')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'picks'
                ? 'bg-red-500/30 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pick Order
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'roster'
                ? 'bg-red-500/30 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Roster
          </button>
        </div>
        {activeTab === 'picks' && currentPicker && (
          <div className="flex items-center space-x-2 text-red-300">
            <ClockIcon className="h-5 w-5" />
            <span className="text-sm font-medium">
              {currentPicker.id === currentUserId
                ? "It's your turn!"
                : `Waiting for ${currentPicker.name}...`}
            </span>
          </div>
        )}
      </div>

      {activeTab === 'picks' ? (
        <div className="space-y-3">
          {users.map((user, index) => {
            const selectedPlayer = roster.find((p) => p.id === user.pick)

            const isCurrentPicker = index === currentPickerIndex

            const canPick = isCurrentPicker && user.id === currentUserId

            const isWaiting = index > currentPickerIndex

            return (
              <div
                key={user.id}
                className={`backdrop-blur-xl p-5 rounded-2xl border transition-all ${
                  isCurrentPicker
                    ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20'
                    : isWaiting
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex flex-col items-center justify-center min-w-[3rem]">
                      <div className="text-2xl font-bold text-white">
                        {user.points}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        pts
                      </div>
                    </div>

                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${
                        user.pick
                          ? 'bg-green-500/20 border-green-500/50'
                          : isCurrentPicker
                          ? 'bg-red-500/20 border-red-500/50'
                          : 'bg-white/10 border-white/20'
                      }`}
                    >
                      {user.pick ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      ) : isWaiting ? (
                        <LockIcon className="h-6 w-6 text-gray-500" />
                      ) : (
                        <UserIcon className="h-6 w-6 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p
                        className={`font-semibold ${
                          user.id === currentUserId ? 'text-white' : 'text-gray-200'
                        }`}
                      >
                        {user.name}
                        {user.id === currentUserId && (
                          <span className="ml-2 text-xs bg-red-500/30 px-2 py-1 rounded-full">
                            You
                          </span>
                        )}
                      </p>
                      {selectedPlayer ? (
                        <p className="text-sm text-green-400 font-medium mt-1">
                          #{selectedPlayer.number} {selectedPlayer.name} (
                          {selectedPlayer.position})
                        </p>
                      ) : isWaiting ? (
                        <p className="text-sm text-gray-500 mt-1">
                          Waiting for turn...
                        </p>
                      ) : isCurrentPicker ? (
                        <p className="text-sm text-red-300 mt-1">
                          {user.id === currentUserId
                            ? 'Make your pick'
                            : 'Picking now...'}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {canPick && (
                    <div className="w-64">
                      <select
                        value={user.pick || ''}
                        onChange={(e) => handlePickChange(user.id, e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                      >
                        <option value="" className="bg-gray-900">
                          Select player...
                        </option>
                        {availableRoster.map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            className="bg-gray-900"
                          >
                            #{player.number} {player.name} ({player.position})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr,80px,80px,80px,100px] gap-4 px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
            <div>Player</div>
            <div className="text-center">G</div>
            <div className="text-center">A</div>
            <div className="text-center">PTS</div>
            <div className="text-center">Odds</div>
          </div>

          {/* Player Rows */}
          {rosterWithStats
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .map((player) => (
              <div
                key={player.id}
                className="backdrop-blur-xl bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="grid grid-cols-[1fr,80px,80px,80px,100px] gap-4 items-center">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                      <span className="text-red-200 font-bold text-sm">
                        {player.number}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{player.name}</p>
                      <p className="text-gray-400 text-sm">{player.position}</p>
                    </div>
                  </div>
                  <div className="text-center text-white font-semibold">
                    {player.goals}
                  </div>
                  <div className="text-center text-white font-semibold">
                    {player.assists}
                  </div>
                  <div className="text-center text-red-300 font-bold text-lg">
                    {player.points}
                  </div>
                  <div className="text-center">
                    <span
                      className={`text-sm font-semibold ${
                        Math.random() > 0.5 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {Math.random() > 0.5 ? '+' : '-'}
                      {Math.floor(Math.random() * 200 + 100)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

