"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import type {
  Game,
  GameResult,
  UserPick,
  User,
} from '@/lib/types'

interface GameContextType {
  currentGame: Game | null
  currentPicks: UserPick[]
  latestCompletedGame: Game | null
  latestGameResult: GameResult | null
  latestPicks: UserPick[]
  userScores: Map<string, number> // userId -> totalSeasonPoints
  users: User[]
  isLoading: boolean
  picksLocked: boolean
  
  // Actions
  makePick: (userId: string, playerId: string | 'team', playerPosition?: string) => Promise<boolean>
  refreshGameData: () => Promise<void>
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export function useGame() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [currentPicks, setCurrentPicks] = useState<UserPick[]>([])
  const [latestCompletedGame, setLatestCompletedGame] = useState<Game | null>(null)
  const [latestGameResult, setLatestGameResult] = useState<GameResult | null>(null)
  const [latestPicks, setLatestPicks] = useState<UserPick[]>([])
  const [userScores, setUserScores] = useState<Map<string, number>>(new Map())
  const [users, setUsers] = useState<User[]>([])
  const [picksLocked, setPicksLocked] = useState(false)
  type ApiUser = {
    id: string
    name: string
    email?: string
    totalSeasonPoints?: number
  }
  
  // Function to fetch users from database
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched users:', data.users?.length || 0)
        if (data.users && Array.isArray(data.users)) {
          const apiUsers = data.users as ApiUser[]
          setUsers(apiUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })))
          
          // Also update userScores from database
          const scoresMap = new Map<string, number>()
          apiUsers.forEach((u) => {
            if (u.totalSeasonPoints) {
              scoresMap.set(u.id, u.totalSeasonPoints)
            }
          })
          setUserScores(scoresMap)
        } else {
          console.warn('No users in response:', data)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch users:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  const fetchCurrentGame = useCallback(async () => {
    const response = await fetch('/api/game/current')
    if (!response.ok) {
      throw new Error('Failed to fetch current game')
    }
    const data = await response.json()
    const normalizedGame = data.game
      ? {
          ...data.game,
          gameState: data.gameState || undefined,
          period: data.period ?? undefined,
          clock: data.clock || undefined,
          inIntermission:
            typeof data.inIntermission === 'boolean'
              ? data.inIntermission
              : undefined,
        }
      : null

    setCurrentGame(normalizedGame)
    setPicksLocked(Boolean(data.picksLocked))
    return normalizedGame as Game
  }, [])

  const fetchPicks = useCallback(async (gameId: string) => {
    const response = await fetch(`/api/picks?gameId=${gameId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch picks')
    }
    const data = await response.json()
    setCurrentPicks(data.picks || [])
  }, [])

  const fetchLatestResults = useCallback(async () => {
    const response = await fetch('/api/game/latest-results')
    if (!response.ok) {
      throw new Error('Failed to fetch latest results')
    }
    const data = await response.json()
    setLatestCompletedGame(data.game || null)
    setLatestGameResult(data.gameResult || null)
    setLatestPicks(data.picks || [])
  }, [])

  const refreshGameData = useCallback(async () => {
    try {
      await fetch('/api/game/finalize')
      await fetchUsers()
      const game = await fetchCurrentGame()
      if (game?.id) {
        await fetchPicks(game.id)
      }
      await fetchLatestResults()
    } catch (error) {
      console.error('Error refreshing game data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchUsers, fetchCurrentGame, fetchPicks, fetchLatestResults])
  
  useEffect(() => {
    refreshGameData()
  }, [refreshGameData])

  useEffect(() => {
    if (currentUser) {
      fetchUsers()
    }
  }, [currentUser, fetchUsers])

  const makePick = useCallback(
    async (userId: string, playerId: string | 'team', playerPosition?: string) => {
      if (!currentGame || picksLocked) return false

      const response = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          gameId: currentGame.id,
          playerId,
          playerPosition,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to save pick:', errorText)
        return false
      }

      await fetchPicks(currentGame.id)
      await fetchCurrentGame()
      return true
    },
    [currentGame, picksLocked, fetchPicks, fetchCurrentGame],
  )

  const value: GameContextType = {
    currentGame,
    currentPicks,
    latestCompletedGame,
    latestGameResult,
    latestPicks,
    userScores,
    users,
    isLoading,
    picksLocked,
    makePick,
    refreshGameData,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
