"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { UserIcon, LockIcon, CheckCircleIcon, ClockIcon } from 'lucide-react'
import { useGame } from '@/contexts/GameContext'
import { getTopScorerIds } from '@/lib/gameSimulator'
import type { Player } from '@/lib/types'

interface PickOrderProps {
  currentUserId: string
  roster: Player[]
}

export function PickOrder({ currentUserId, roster }: PickOrderProps) {
  const [activeTab, setActiveTab] = useState<'picks' | 'roster'>('picks')
  const [queuedPicksByGame, setQueuedPicksByGame] = useState<Record<string, string>>({})
  const isSubmittingQueuedPickRef = useRef(false)
  const {
    currentGame,
    currentPicks,
    users,
    userScores,
    picksLocked,
    makePick,
  } = useGame()

  const isGameCompleted = currentGame?.status === 'completed'

  // Get pick for each user
  const usersWithPicks = useMemo(() => {
    return users.map((user) => {
      const pick = currentPicks.find((p) => p.userId === user.id && p.gameId === currentGame?.id)
      const totalScore = userScores.get(user.id) || 0

      return {
        ...user,
        pick: pick?.playerId || null,
        pickType: pick?.playerId === 'team' ? 'team' : 'player',
        totalScore,
      }
    })
  }, [users, currentPicks, currentGame, userScores])

  // Find the first user without a pick
  const currentPickerIndex = usersWithPicks.findIndex((user) => !user.pick)
  const currentPicker = usersWithPicks[currentPickerIndex]

  // Check if all users have made picks
  const allPicksMade = picksLocked && !isGameCompleted

  const topScorerIds = useMemo(() => getTopScorerIds(roster), [roster])

  // Get already picked player IDs (exclude 'team')
  const pickedPlayerIds = usersWithPicks
    .filter((user) => user.pick && user.pick !== 'team')
    .map((user) => user.pick) as string[]

  // Check if "team" has been picked
  const teamPicked = usersWithPicks.some((user) => user.pick === 'team')

  // Identify goalies (Cam Talbot and John Gibson)
  const goalieNames = ['Cam Talbot', 'John Gibson']
  const goalieIds = roster
    .filter((player) => goalieNames.includes(player.name))
    .map((player) => player.id)

  // Check if any goalie has been picked
  const goaliePicked = pickedPlayerIds.some((id) => goalieIds.includes(id))

  // Filter available roster - exclude picked players and goalies if a goalie was already picked
  const availableRoster = roster.filter((player) => {
    // Exclude if player was already picked
    if (pickedPlayerIds.includes(player.id)) return false
    
    // If a goalie was already picked, exclude all goalies
    if (goaliePicked && goalieIds.includes(player.id)) return false
    
    return true
  })

  const isLoneWolf = (playerId: string) => !topScorerIds.has(playerId)

  const queuedPick = currentGame?.id ? queuedPicksByGame[currentGame.id] || '' : ''
  const setQueuedPick = (value: string) => {
    if (!currentGame?.id) return
    setQueuedPicksByGame((prev) => {
      if (!value) {
        const next = { ...prev }
        delete next[currentGame.id]
        return next
      }
      return {
        ...prev,
        [currentGame.id]: value,
      }
    })
  }

  // Roster already comes with stats from the API, sorted by points
  // Just ensure we have the right type
  const rosterWithStats = roster.map((player) => ({
    ...player,
    goals: player.goals ?? 0,
    assists: player.assists ?? 0,
    points: player.points ?? 0,
  }))

  const queuedPickIsAvailable = (() => {
    if (!queuedPick) return false
    if (queuedPick === 'team') return !teamPicked
    if (pickedPlayerIds.includes(queuedPick)) return false
    if (goaliePicked && goalieIds.includes(queuedPick)) return false
    return true
  })()

  const submitPickValue = useCallback(async (userId: string, value: string) => {
    if (!currentGame || isGameCompleted || picksLocked) return false

    if (value === 'team') {
      return makePick(userId, 'team')
    }

    const player = roster.find((p) => p.id === value)
    if (!player) return false
    return makePick(userId, value, player.position)
  }, [currentGame, isGameCompleted, picksLocked, makePick, roster])

  const handlePickChange = (userId: string, value: string) => {
    void submitPickValue(userId, value)
  }

  useEffect(() => {
    const isCurrentUserTurn = currentPicker?.id === currentUserId
    const currentUserHasPick = usersWithPicks.some(
      (user) => user.id === currentUserId && Boolean(user.pick),
    )

    if (
      !currentGame ||
      !queuedPick ||
      !isCurrentUserTurn ||
      currentUserHasPick ||
      isGameCompleted ||
      picksLocked ||
      !queuedPickIsAvailable ||
      isSubmittingQueuedPickRef.current
    ) {
      return
    }

    isSubmittingQueuedPickRef.current = true
    void submitPickValue(currentUserId, queuedPick)
      .then((success) => {
        if (!success || !currentGame?.id) return
        setQueuedPicksByGame((prev) => {
          const next = { ...prev }
          delete next[currentGame.id]
          return next
        })
      })
      .finally(() => {
        isSubmittingQueuedPickRef.current = false
      })
  }, [
    currentGame,
    queuedPick,
    currentPicker,
    currentUserId,
    usersWithPicks,
    isGameCompleted,
    picksLocked,
    queuedPickIsAvailable,
    currentGame?.id,
    submitPickValue,
  ])

  return (
    <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl relative">
      {/* Green overlay when all picks are locked */}
      {allPicksMade && (
        <div className="absolute inset-0 bg-green-500/20 border-2 border-green-500/50 rounded-3xl z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <LockIcon className="h-8 w-8 text-green-400" />
              <h3 className="text-3xl font-bold text-green-300 uppercase tracking-wide">
                Picks Locked
              </h3>
            </div>
            <p className="text-green-200 text-sm">All users have made their selections</p>
          </div>
        </div>
      )}
      
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
          {usersWithPicks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No users found. Please refresh the page.</p>
            </div>
          ) : (
            usersWithPicks.map((user, index) => {
            const selectedPlayer = user.pick && user.pick !== 'team' 
              ? roster.find((p) => p.id === user.pick) 
              : null

            const isCurrentPicker = index === currentPickerIndex
            const isCurrentUser = user.id === currentUserId
            const canPick = isCurrentPicker && isCurrentUser && !isGameCompleted && !picksLocked
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
                      ) : !user.pick &&
                        isCurrentUser &&
                        !isCurrentPicker &&
                        !isGameCompleted &&
                        !picksLocked ? (
                        <p className="text-sm text-amber-300 mt-1">
                          Potential pick: {queuedPick || 'Not set'}
                          {queuedPick && !queuedPickIsAvailable ? ' (Unavailable now)' : ''}
                        </p>
                      ) : isCurrentPicker && !isGameCompleted ? (
                        <p className="text-sm text-red-300 mt-1">
                          {isCurrentUser
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
                        disabled={isGameCompleted || picksLocked}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" className="bg-gray-900">
                          Select player...
                        </option>
                        {!teamPicked && (
                          <option value="team" className="bg-gray-900">
                            The Team
                          </option>
                        )}
                        {availableRoster.map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            className="bg-gray-900"
                          >
                            #{player.number} {player.name} ({player.position})
                            {isLoneWolf(player.id) ? ' — Lone Wolf' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!user.pick &&
                    isCurrentUser &&
                    !isCurrentPicker &&
                    !isGameCompleted &&
                    !picksLocked && (
                      <div className="w-64">
                        <select
                          value={queuedPick}
                          onChange={(e) => setQueuedPick(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                        >
                          <option value="" className="bg-gray-900">
                            Set potential pick...
                          </option>
                          {!teamPicked && (
                            <option value="team" className="bg-gray-900">
                              The Team
                            </option>
                          )}
                          {availableRoster.map((player) => (
                            <option
                              key={player.id}
                              value={player.id}
                              className="bg-gray-900"
                            >
                              #{player.number} {player.name} ({player.position})
                              {isLoneWolf(player.id) ? ' — Lone Wolf' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>
              </div>
            )
          }))}
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
          {rosterWithStats.map((player) => {
            const impliedOdds = 100 + Math.min(300, (player.points ?? 0) * 8 + (player.goals ?? 0) * 4)
            const isValuePick = isLoneWolf(player.id)
            return (
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
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate">{player.name}</p>
                        {isLoneWolf(player.id) && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                            Lone Wolf
                          </span>
                        )}
                      </div>
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
                        isValuePick ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {isValuePick ? '+' : '-'}
                      {impliedOdds}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
