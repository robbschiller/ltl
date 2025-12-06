"use client"

import React, { useState, useMemo } from 'react'
import { UserIcon, LockIcon, CheckCircleIcon, ClockIcon } from 'lucide-react'
import { useGame } from '@/contexts/GameContext'
import type { Player } from '@/lib/types'

interface PickOrderProps {
  currentUserId: string
  roster: Player[]
}

export function PickOrder({ currentUserId, roster }: PickOrderProps) {
  const [activeTab, setActiveTab] = useState<'picks' | 'roster'>('picks')
  const {
    currentGame,
    currentPicks,
    users,
    userScores,
    makePick,
    getUserScoreForGame,
    getTotalScoreForUser,
  } = useGame()

  const isGameCompleted = currentGame?.status === 'completed'

  // Get pick for each user
  const usersWithPicks = useMemo(() => {
    return users.map((user) => {
      const pick = currentPicks.find((p) => p.userId === user.id && p.gameId === currentGame?.id)
      const totalScore = getTotalScoreForUser(user.id)
      
      // Get game points if game is completed
      const gamePoints = isGameCompleted && currentGame 
        ? getUserScoreForGame(user.id, currentGame.id)
        : 0

      return {
        ...user,
        pick: pick?.playerId || null,
        pickType: pick?.playerId === 'team' ? 'team' : 'player',
        totalScore,
        gamePoints,
      }
    })
  }, [users, currentPicks, currentGame, isGameCompleted, getTotalScoreForUser, getUserScoreForGame])

  const handlePickChange = (userId: string, value: string) => {
    if (!currentGame || isGameCompleted) return

    if (value === 'team') {
      makePick(userId, 'team')
    } else {
      const player = roster.find((p) => p.id === value)
      if (player) {
        makePick(userId, value, player.position)
      }
    }
  }

  // Find the first user without a pick
  const currentPickerIndex = usersWithPicks.findIndex((user) => !user.pick)
  const currentPicker = usersWithPicks[currentPickerIndex]

  // Get already picked player IDs (exclude 'team')
  const pickedPlayerIds = usersWithPicks
    .filter((user) => user.pick && user.pick !== 'team')
    .map((user) => user.pick) as string[]

  // Filter available roster
  const availableRoster = roster.filter(
    (player) => !pickedPlayerIds.includes(player.id),
  )

  // Roster already comes with stats from the API, sorted by points
  // Just ensure we have the right type
  const rosterWithStats = roster.map((player) => ({
    ...player,
    goals: (player as any).goals || 0,
    assists: (player as any).assists || 0,
    points: (player as any).points || 0,
  }))

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
          {usersWithPicks.map((user, index) => {
            const selectedPlayer = user.pick && user.pick !== 'team' 
              ? roster.find((p) => p.id === user.pick) 
              : null

            const isCurrentPicker = index === currentPickerIndex
            const canPick = isCurrentPicker && !isGameCompleted
            const isWaiting = index > currentPickerIndex

            return (
              <div
                key={user.id}
                className={`backdrop-blur-xl p-5 rounded-2xl border transition-all ${
                  isCurrentPicker && !isGameCompleted
                    ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20'
                    : isWaiting && !isGameCompleted
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex flex-col items-center justify-center min-w-[3rem]">
                      <div className="text-2xl font-bold text-white">
                        {user.totalScore}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        pts
                      </div>
                      {isGameCompleted && user.gamePoints > 0 && (
                        <div className="text-xs text-green-400 font-medium mt-1">
                          +{user.gamePoints}
                        </div>
                      )}
                    </div>

                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${
                        user.pick
                          ? 'bg-green-500/20 border-green-500/50'
                          : isCurrentPicker && !isGameCompleted
                          ? 'bg-red-500/20 border-red-500/50'
                          : 'bg-white/10 border-white/20'
                      }`}
                    >
                      {user.pick ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      ) : isWaiting && !isGameCompleted ? (
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
                      {user.pick === 'team' ? (
                        <p className="text-sm text-green-400 font-medium mt-1">
                          The Team
                          <span className="ml-2 text-xs bg-blue-500/30 px-2 py-0.5 rounded-full">
                            Team
                          </span>
                        </p>
                      ) : selectedPlayer ? (
                        <p className="text-sm text-green-400 font-medium mt-1">
                          #{selectedPlayer.number} {selectedPlayer.name} (
                          {selectedPlayer.position})
                        </p>
                      ) : isWaiting && !isGameCompleted ? (
                        <p className="text-sm text-gray-500 mt-1">
                          Waiting for turn...
                        </p>
                      ) : isCurrentPicker && !isGameCompleted ? (
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
                        disabled={isGameCompleted}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" className="bg-gray-900">
                          Select player...
                        </option>
                        <option value="team" className="bg-gray-900">
                          The Team
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
          <div className="flex gap-4 px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
            <div className="flex-1">Player</div>
            <div className="w-20 text-center">G</div>
            <div className="w-20 text-center">A</div>
            <div className="w-20 text-center">PTS</div>
            <div className="w-24 text-center">Odds</div>
          </div>

          {/* Player Rows - Already sorted by points from API */}
          {rosterWithStats.map((player) => (
              <div
                key={player.id}
                className="backdrop-blur-xl bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex gap-4 items-center">
                  <div className="flex-1 flex items-center space-x-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 flex-shrink-0">
                      <span className="text-red-200 font-bold text-sm">
                        {player.number}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{player.name}</p>
                      <p className="text-gray-400 text-sm">{player.position}</p>
                    </div>
                  </div>
                  <div className="w-20 text-center text-white font-semibold">
                    {player.goals ?? 0}
                  </div>
                  <div className="w-20 text-center text-white font-semibold">
                    {player.assists ?? 0}
                  </div>
                  <div className="w-20 text-center text-red-300 font-bold text-lg">
                    {player.points ?? 0}
                  </div>
                  <div className="w-24 text-center">
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

