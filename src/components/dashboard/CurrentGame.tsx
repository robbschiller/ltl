"use client"

import React, { useMemo } from 'react'
import type { Game, Player, User, UserPick } from '@/lib/types'

interface CurrentGameProps {
  game: Game
  picks: UserPick[]
  users: User[]
  roster: Player[]
}

export function CurrentGame({ game, picks, users, roster }: CurrentGameProps) {
  const picksByUser = useMemo(() => {
    const map = new Map<string, UserPick>()
    picks.forEach((pick) => map.set(pick.userId, pick))
    return map
  }, [picks])
  const rosterById = useMemo(() => {
    const map = new Map<string, Player>()
    roster.forEach((player) => map.set(player.id, player))
    return map
  }, [roster])

  return (
    <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Current Game</h2>
          <p className="text-sm text-gray-400">
            Picks are locked and the game is live.
          </p>
        </div>
        <div className="text-sm text-gray-300">
          {game.date} • {game.time}
        </div>
      </div>
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Red Wings</p>
            <p className="text-3xl font-bold text-white">{game.teamGoals}</p>
          </div>
          <div className="text-2xl font-bold text-gray-400">-</div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">{game.opponent}</p>
            <p className="text-3xl font-bold text-white">{game.opponentGoals}</p>
          </div>
        </div>
        <div className="mt-3 text-center text-xs text-gray-400 uppercase tracking-wide">
          {game.status === 'live' ? (
            <>
              Live
              {game.period ? ` • P${game.period}` : ''}
              {game.clock ? ` • ${game.clock}` : ''}
              {game.inIntermission ? ' • Intermission' : ''}
            </>
          ) : game.status === 'completed' ? (
            <>Final</>
          ) : (
            <>Pre-game</>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {users.map((user) => {
          const pick = picksByUser.get(user.id)
          const player =
            pick && pick.playerId !== 'team'
              ? rosterById.get(pick.playerId)
              : null
          const pickName = pick
            ? pick.playerId === 'team'
              ? 'The Team'
              : player
                ? `#${player.number} ${player.name}`
                : 'Unknown Player'
            : 'No pick'

          return (
            <div
              key={user.id}
              className="flex items-center justify-between bg-white/5 p-4 rounded-2xl"
            >
              <div>
                <p className="text-white font-semibold">{user.name}</p>
                <p className="text-sm text-gray-400">Picked: {pickName}</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-gray-400">
                Locked
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
