"use client"

import React, { useMemo, useState, useEffect } from 'react'
import type { Player } from '@/lib/types'
import { getTopScorerIds } from '@/lib/gameSimulator'

interface AdminControlsProps {
  users: Array<{ id: string; name: string; email?: string }>
  roster: Player[]
  currentGameId: string
  onRefresh: () => Promise<void>
  userScores: Map<string, number>
  currentUserId: string
}

export function AdminControls({
  users,
  roster,
  currentGameId,
  onRefresh,
  userScores,
  currentUserId,
}: AdminControlsProps) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [selectedPick, setSelectedPick] = useState('')
  const [scoreEdits, setScoreEdits] = useState<Record<string, string>>({})
  const [isSavingPick, setIsSavingPick] = useState(false)
  const [isSavingScores, setIsSavingScores] = useState(false)
  const [isRemovingUser, setIsRemovingUser] = useState(false)
  const [pickOrderIds, setPickOrderIds] = useState<string[]>([])
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const rosterOptions = useMemo(() => {
    const topScorerIds = getTopScorerIds(roster)
    return roster.map((player) => ({
      value: player.id,
      label: `#${player.number} ${player.name} (${player.position})${topScorerIds.has(player.id) ? '' : ' — Lone Wolf'}`,
    }))
  }, [roster])

  useEffect(() => {
    setPickOrderIds(users.map((user) => user.id))
  }, [users])

  const orderedPickUsers = useMemo(() => {
    const userMap = new Map(users.map((user) => [user.id, user]))
    const ordered = pickOrderIds
      .map((id) => userMap.get(id))
      .filter((user): user is { id: string; name: string; email?: string } => Boolean(user))

    users.forEach((user) => {
      if (!pickOrderIds.includes(user.id)) {
        ordered.push(user)
      }
    })

    return ordered
  }, [pickOrderIds, users])

  const handlePickSubmit = async () => {
    if (!selectedUserId || !selectedPick) return

    setIsSavingPick(true)
    const response = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedUserId,
        gameId: currentGameId,
        playerId: selectedPick,
      }),
    })
    setIsSavingPick(false)

    if (!response.ok) {
      const message = await response.text()
      console.error('Admin pick failed:', message)
      return
    }

    await onRefresh()
    setSelectedPick('')
  }

  const handleScoreChange = (userId: string, value: string) => {
    setScoreEdits((prev) => ({ ...prev, [userId]: value }))
  }

  const handleSaveScores = async () => {
    setIsSavingScores(true)
    const updates = users.map(async (user) => {
      const value = scoreEdits[user.id]
      if (value === undefined || value === '') return
      const totalSeasonPoints = Number(value)
      if (Number.isNaN(totalSeasonPoints)) return

      await fetch('/api/users/update-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, totalSeasonPoints }),
      })
    })
    await Promise.all(updates)
    setIsSavingScores(false)
    setScoreEdits({})
    await onRefresh()
  }

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (userId === currentUserId) {
      window.alert('You cannot remove yourself.')
      return
    }

    const confirmation = window.prompt(
      `Type "${userName}" to confirm removal.`,
      '',
    )
    if (confirmation?.trim() !== userName) {
      return
    }

    setIsRemovingUser(true)
    const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    setIsRemovingUser(false)

    if (!response.ok) {
      const message = await response.text()
      console.error('Failed to remove user:', message)
      return
    }

    if (selectedUserId === userId) {
      setSelectedUserId(users.find((user) => user.id !== userId)?.id || '')
    }

    await onRefresh()
  }

  const movePickOrder = (userId: string, direction: 'up' | 'down') => {
    setPickOrderIds((prev) => {
      const index = prev.indexOf(userId)
      if (index === -1) return prev
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const nextOrder = [...prev]
      const [removed] = nextOrder.splice(index, 1)
      nextOrder.splice(nextIndex, 0, removed)
      return nextOrder
    })
  }

  const handleSavePickOrder = async () => {
    if (pickOrderIds.length === 0) return
    setIsSavingOrder(true)
    const response = await fetch('/api/pick-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: pickOrderIds }),
    })
    setIsSavingOrder(false)

    if (!response.ok) {
      const message = await response.text()
      console.error('Failed to update pick order:', message)
      return
    }

    await onRefresh()
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
      <h3 className="text-lg font-semibold text-white mb-4">Admin Controls</h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Pick For User</h4>
          <div className="space-y-3">
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id} className="bg-gray-900">
                  {user.name}
                  {user.email ? ` (${user.email})` : ''}
                </option>
              ))}
            </select>
            <select
              value={selectedPick}
              onChange={(event) => setSelectedPick(event.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white"
            >
              <option value="" className="bg-gray-900">
                Select pick...
              </option>
              <option value="team" className="bg-gray-900">
                The Team
              </option>
              {rosterOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={handlePickSubmit}
              disabled={!selectedUserId || !selectedPick || isSavingPick}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {isSavingPick ? 'Saving...' : 'Set Pick'}
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Adjust Scores</h4>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{user.name}</span>
                  {user.email && (
                    <div className="text-xs text-gray-400">{user.email}</div>
                  )}
                </div>
                <input
                  type="number"
                  value={scoreEdits[user.id] ?? userScores.get(user.id) ?? 0}
                  onChange={(event) => handleScoreChange(user.id, event.target.value)}
                  className="w-24 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveScores}
            disabled={isSavingScores}
            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {isSavingScores ? 'Saving...' : 'Save Scores'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Remove User</h4>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-200">{user.name}</span>
                {user.email && (
                  <div className="text-xs text-gray-400">{user.email}</div>
                )}
              </div>
              <button
                onClick={() => handleRemoveUser(user.id, user.name)}
                disabled={isRemovingUser}
                className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Adjust Pick Order</h4>
        <div className="space-y-2">
          {orderedPickUsers.map((user, index) => (
            <div key={user.id} className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-200">
                  {index + 1}. {user.name}
                </span>
                {user.email && (
                  <div className="text-xs text-gray-400">{user.email}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => movePickOrder(user.id, 'up')}
                  disabled={index === 0}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
                >
                  Up
                </button>
                <button
                  onClick={() => movePickOrder(user.id, 'down')}
                  disabled={index === orderedPickUsers.length - 1}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleSavePickOrder}
          disabled={isSavingOrder}
          className="mt-3 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {isSavingOrder ? 'Saving...' : 'Save Pick Order'}
        </button>
      </div>
    </div>
  )
}
