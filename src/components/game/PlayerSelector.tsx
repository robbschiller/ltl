"use client"

import { useState, useEffect } from "react"
import { SearchIcon } from "lucide-react"

interface Player {
  id: string
  name: string
  number: number | null
  position: string
  isActive: boolean
}

interface PlayerSelectorProps {
  players: Player[]
  selectedPlayerId: string | null
  onSelectPlayer: (player: Player) => void
  disabled?: boolean
}

export function PlayerSelector({
  players,
  selectedPlayerId,
  onSelectPlayer,
  disabled = false
}: PlayerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredPosition, setFilteredPosition] = useState<string>("all")

  // Filter players by search term and position
  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.number?.toString().includes(searchTerm)

    const matchesPosition =
      filteredPosition === "all" || player.position === filteredPosition

    return matchesSearch && matchesPosition && player.isActive
  })

  // Group players by position
  const playersByPosition = {
    Forward: filteredPlayers.filter((p) => p.position === "Forward"),
    Defense: filteredPlayers.filter((p) => p.position === "Defense"),
    Goalie: filteredPlayers.filter((p) => p.position === "Goalie"),
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
            disabled={disabled}
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setFilteredPosition("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filteredPosition === "all"
                ? "bg-red-500/20 text-red-200 border border-red-500/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
            disabled={disabled}
          >
            All
          </button>
          <button
            onClick={() => setFilteredPosition("Forward")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filteredPosition === "Forward"
                ? "bg-red-500/20 text-red-200 border border-red-500/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
            disabled={disabled}
          >
            Forwards
          </button>
          <button
            onClick={() => setFilteredPosition("Defense")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filteredPosition === "Defense"
                ? "bg-red-500/20 text-red-200 border border-red-500/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
            disabled={disabled}
          >
            Defensemen
          </button>
          <button
            onClick={() => setFilteredPosition("Goalie")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filteredPosition === "Goalie"
                ? "bg-red-500/20 text-red-200 border border-red-500/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
            disabled={disabled}
          >
            Goalies
          </button>
        </div>
      </div>

      {/* Players by Position */}
      <div className="space-y-6 max-h-96 overflow-y-auto">
        {Object.entries(playersByPosition).map(([position, positionPlayers]) => {
          if (positionPlayers.length === 0) return null

          return (
            <div key={position}>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase">
                {position} ({positionPlayers.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {positionPlayers.map((player) => {
                  const isSelected = selectedPlayerId === player.id

                  return (
                    <button
                      key={player.id}
                      onClick={() => !disabled && onSelectPlayer(player)}
                      disabled={disabled}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-red-500/30"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">{player.name}</p>
                          {player.number && (
                            <p className="text-xs text-gray-400">#{player.number}</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No players found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}

