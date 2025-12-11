import type { Player, GamePlayerStats } from './types'

/**
 * Player matching utilities
 * Handles matching roster players to game stats by ID or NHL ID
 */

/**
 * Checks if a roster player matches a game stat by ID
 * Tries direct ID match first, then NHL player ID match
 */
export function matchesPlayerStats(
  player: Player,
  stats: GamePlayerStats,
): boolean {
  // Try direct ID match
  if (player.id === stats.playerId) return true
  
  // Try matching by NHL player ID
  const playerWithNhlId = player as Player & { playerId?: number }
  const nhlId = playerWithNhlId.playerId
  if (nhlId && String(nhlId) === String(stats.playerId)) return true
  
  return false
}

/**
 * Finds player stats for a roster player from game stats array
 * Returns the matching stats or null if not found
 */
export function findPlayerStats(
  player: Player,
  gameStats: GamePlayerStats[],
): GamePlayerStats | null {
  return gameStats.find((stats) => matchesPlayerStats(player, stats)) || null
}

/**
 * Normalizes position codes to standard format
 * Converts 'L' -> 'LW', 'R' -> 'RW' for consistency
 */
export function normalizePosition(position: string): string {
  const positionMap: Record<string, string> = {
    L: 'LW',
    R: 'RW',
  }
  return positionMap[position] || position
}

/**
 * Checks if a position is a forward position
 */
export function isForwardPosition(position: string): boolean {
  const normalized = normalizePosition(position)
  return ['C', 'LW', 'RW'].includes(normalized)
}

/**
 * Checks if a position is a defenseman position
 */
export function isDefensemanPosition(position: string): boolean {
  return position === 'D'
}

/**
 * Checks if a position is a goalie position
 */
export function isGoaliePosition(position: string): boolean {
  return position === 'G'
}

