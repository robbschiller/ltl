"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type {
  Game,
  GameResult,
  UserPick,
  UserScore,
  User,
  Player,
} from '@/lib/types'
import {
  simulateGame,
  calculateUserScores,
} from '@/lib/gameSimulator'

interface GameContextType {
  currentGame: Game | null
  currentPicks: UserPick[]
  gameResults: GameResult[]
  userScores: Map<string, number> // userId -> totalSeasonPoints
  gameUserScores: Map<string, Map<string, number>> // gameId -> userId -> points for that game
  users: User[]
  isLoading: boolean
  
  // Actions
  makePick: (userId: string, playerId: string | 'team', playerPosition?: string) => void
  simulateCurrentGame: (roster: Player[]) => Promise<void>
  startNextGame: (opponent: string, opponentLogo: string, date: string, time: string, venue: string, isHome: boolean, nhlGameData?: any) => void
  getPlayerStatsForGame: (gameId: string, playerId: string) => GameResult['playerStats'][0] | null
  getUserScoreForGame: (userId: string, gameId: string) => number
  getTotalScoreForUser: (userId: string) => number
  resetAllScores: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

const STORAGE_KEYS = {
  currentGame: 'lightTheLamp_currentGame',
  currentPicks: 'lightTheLamp_currentPicks',
  gameResults: 'lightTheLamp_gameResults',
  userScores: 'lightTheLamp_userScores',
  gameUserScores: 'lightTheLamp_gameUserScores',
  users: 'lightTheLamp_users',
}

export function useGame() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  
  try {
    const item = localStorage.getItem(key)
    if (!item) return defaultValue
    
    // Handle Map specially
    if (key === STORAGE_KEYS.userScores) {
      const data = JSON.parse(item) as Record<string, number>
      return new Map(Object.entries(data)) as T
    }
    
    // Handle nested Map for gameUserScores
    if (key === STORAGE_KEYS.gameUserScores) {
      const data = JSON.parse(item) as Record<string, Record<string, number>>
      const map = new Map<string, Map<string, number>>()
      Object.entries(data).forEach(([gameId, scores]) => {
        map.set(gameId, new Map(Object.entries(scores)))
      })
      return map as T
    }
    
    return JSON.parse(item) as T
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error)
    return defaultValue
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  
  try {
    // Handle Map specially
    if (value instanceof Map) {
      const obj = Object.fromEntries(value)
      localStorage.setItem(key, JSON.stringify(obj))
      return
    }
    
    // Handle nested Map for gameUserScores
    if (key === STORAGE_KEYS.gameUserScores && value instanceof Map) {
      const obj: Record<string, Record<string, number>> = {}
      value.forEach((innerMap, gameId) => {
        obj[gameId] = Object.fromEntries(innerMap)
      })
      localStorage.setItem(key, JSON.stringify(obj))
      return
    }
    
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error)
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [currentPicks, setCurrentPicks] = useState<UserPick[]>([])
  const [gameResults, setGameResults] = useState<GameResult[]>([])
  const [userScores, setUserScores] = useState<Map<string, number>>(new Map())
  const [gameUserScores, setGameUserScores] = useState<Map<string, Map<string, number>>>(new Map())
  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'Sarah Johnson' },
    { id: '2', name: 'Mike Williams' },
    { id: 'demo-user-123', name: 'You' },
  ])

  // Load data from localStorage on mount
  useEffect(() => {
    const loadedGame = loadFromStorage<Game | null>(STORAGE_KEYS.currentGame, null)
    const loadedPicks = loadFromStorage<UserPick[]>(STORAGE_KEYS.currentPicks, [])
    const loadedResults = loadFromStorage<GameResult[]>(STORAGE_KEYS.gameResults, [])
    const loadedScores = loadFromStorage<Map<string, number>>(STORAGE_KEYS.userScores, new Map())
    const loadedGameUserScores = loadFromStorage<Map<string, Map<string, number>>>(STORAGE_KEYS.gameUserScores, new Map())
    const loadedUsers = loadFromStorage<User[]>(STORAGE_KEYS.users, users)

    // Initialize with default game if none exists
    if (!loadedGame) {
      const defaultGame: Game = {
        id: `game-${Date.now()}`,
        opponent: 'Toronto Maple Leafs',
        opponentLogo: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b6/Toronto_Maple_Leafs_2016_logo.svg/1200px-Toronto_Maple_Leafs_2016_logo.svg.png',
        date: 'Tonight',
        time: '7:00 PM EST',
        venue: 'Little Caesars Arena',
        isHome: true,
        status: 'upcoming',
        teamGoals: 0,
        opponentGoals: 0,
        wentToOT: false,
        emptyNetGoals: 0,
        shootoutOccurred: false,
      }
      setCurrentGame(defaultGame)
      saveToStorage(STORAGE_KEYS.currentGame, defaultGame)
    } else {
      setCurrentGame(loadedGame)
    }

    setCurrentPicks(loadedPicks)
    setGameResults(loadedResults)
    setUserScores(loadedScores)
    setGameUserScores(loadedGameUserScores)
    setUsers(loadedUsers)
    setIsLoading(false)
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!isLoading && currentGame) {
      saveToStorage(STORAGE_KEYS.currentGame, currentGame)
    }
  }, [currentGame, isLoading])

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.currentPicks, currentPicks)
    }
  }, [currentPicks, isLoading])

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.gameResults, gameResults)
    }
  }, [gameResults, isLoading])

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.userScores, userScores)
    }
  }, [userScores, isLoading])

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.gameUserScores, gameUserScores)
    }
  }, [gameUserScores, isLoading])

  const makePick = useCallback(
    (userId: string, playerId: string | 'team', playerPosition?: string) => {
      if (!currentGame) return

      // Check if user already has a pick for this game
      const existingPickIndex = currentPicks.findIndex(
        (pick) => pick.userId === userId && pick.gameId === currentGame.id,
      )

      const newPick: UserPick = {
        userId,
        gameId: currentGame.id,
        playerId,
        playerPosition: playerPosition || (playerId === 'team' ? undefined : undefined),
      }

      if (existingPickIndex >= 0) {
        // Update existing pick
        setCurrentPicks((prev) => {
          const updated = [...prev]
          updated[existingPickIndex] = newPick
          return updated
        })
      } else {
        // Add new pick
        setCurrentPicks((prev) => [...prev, newPick])
      }
    },
    [currentGame, currentPicks],
  )

  const simulateCurrentGame = useCallback(
    async (roster: Player[]) => {
      if (!currentGame || currentGame.status === 'completed') return

      // Check if we have a real NHL game ID and try to get actual results first
      let result: GameResult | null = null
      const nhlGameId = (currentGame as any).gameId || (currentGame as any).nhlGameData?.id
      
      if (nhlGameId && typeof window !== 'undefined') {
        try {
          // Try to fetch real game results
          const response = await fetch(`/api/nhl/game-results?gameId=${nhlGameId}`)
          if (response.ok) {
            const realResults = await response.json()
            // Parse real results if game is completed
            if (realResults.boxscore && realResults.landing) {
              result = parseRealGameResults(realResults, currentGame, roster)
            }
          }
        } catch (error) {
          console.log('Game not completed yet or error fetching results, will simulate:', error)
        }
      }

      // If no real results, simulate the game
      if (!result) {
        result = simulateGame(roster, currentGame)
      }

      // Calculate user scores for this game
      const gamePicks = currentPicks.filter((p) => p.gameId === currentGame.id)
      const scores = calculateUserScores(gamePicks, result, roster, currentGame)

      // Update game status
      const completedGame: Game = {
        ...currentGame,
        status: 'completed',
      }

      // Store scores for this game
      setGameUserScores((prev) => {
        const updated = new Map(prev)
        updated.set(currentGame.id, scores)
        return updated
      })

      // Update cumulative scores
      setUserScores((prev) => {
        const updated = new Map(prev)
        scores.forEach((points, userId) => {
          const currentTotal = updated.get(userId) || 0
          updated.set(userId, currentTotal + points)
        })
        return updated
      })

      // Save results
      setGameResults((prev) => [...prev, result!])
      setCurrentGame(completedGame)
    },
    [currentGame, currentPicks],
  )

  const startNextGame = useCallback(
    (
      opponent: string,
      opponentLogo: string,
      date: string,
      time: string,
      venue: string,
      isHome: boolean,
      nhlGameData?: any,
    ) => {
      const gameId = nhlGameData?.id ? String(nhlGameData.id) : `game-${Date.now()}`
      
      const newGame: Game = {
        id: gameId,
        opponent,
        opponentLogo,
        date,
        time,
        venue,
        isHome,
        status: 'upcoming',
        teamGoals: 0,
        opponentGoals: 0,
        wentToOT: false,
        emptyNetGoals: 0,
        shootoutOccurred: false,
        ...(nhlGameData && { gameId: nhlGameData.id, nhlGameData }),
      } as Game

      // Clear picks for new game
      setCurrentPicks([])
      setCurrentGame(newGame)
    },
    [],
  )

  const getPlayerStatsForGame = useCallback(
    (gameId: string, playerId: string): GameResult['playerStats'][0] | null => {
      const result = gameResults.find((r) => r.gameId === gameId)
      if (!result) return null

      return result.playerStats.find((stats) => stats.playerId === playerId) || null
    },
    [gameResults],
  )

  const getUserScoreForGame = useCallback(
    (userId: string, gameId: string): number => {
      const gameScores = gameUserScores.get(gameId)
      if (!gameScores) return 0
      return gameScores.get(userId) || 0
    },
    [gameUserScores],
  )

  const getTotalScoreForUser = useCallback(
    (userId: string): number => {
      return userScores.get(userId) || 0
    },
    [userScores],
  )

  const resetAllScores = useCallback(() => {
    // Reset all scores and game history
    setUserScores(new Map())
    setGameUserScores(new Map())
    setGameResults([])
    setCurrentPicks([])
    
    // Reset current game to upcoming status if it exists
    if (currentGame) {
      const resetGame: Game = {
        ...currentGame,
        status: 'upcoming',
        teamGoals: 0,
        opponentGoals: 0,
        wentToOT: false,
        emptyNetGoals: 0,
        shootoutOccurred: false,
      }
      setCurrentGame(resetGame)
    }
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.userScores)
      localStorage.removeItem(STORAGE_KEYS.gameUserScores)
      localStorage.removeItem(STORAGE_KEYS.gameResults)
      localStorage.removeItem(STORAGE_KEYS.currentPicks)
      if (currentGame) {
        const resetGame: Game = {
          ...currentGame,
          status: 'upcoming',
          teamGoals: 0,
          opponentGoals: 0,
          wentToOT: false,
          emptyNetGoals: 0,
          shootoutOccurred: false,
        }
        saveToStorage(STORAGE_KEYS.currentGame, resetGame)
      }
    }
  }, [currentGame])

  const value: GameContextType = {
    currentGame,
    currentPicks,
    gameResults,
    userScores,
    gameUserScores,
    users,
    isLoading,
    makePick,
    simulateCurrentGame,
    startNextGame,
    getPlayerStatsForGame,
    getUserScoreForGame,
    getTotalScoreForUser,
    resetAllScores,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

