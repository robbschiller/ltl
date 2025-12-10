"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import type {
  Game,
  GameResult,
  GamePlayerStats,
  UserPick,
  UserScore,
  User,
  Player,
} from '@/lib/types'
import {
  simulateGame,
  calculateUserScores,
} from '@/lib/gameSimulator'
import { parseRealGameResults } from '@/lib/parseGameResults'
import { fetchAndAdaptLastGame } from '@/lib/historicalDataAdapter'

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
  startNextGame: (opponent: string, opponentLogo: string, date: string, time: string, venue: string, isHome: boolean, nhlGameData?: any, rotateOrder?: boolean) => void
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
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [currentPicks, setCurrentPicks] = useState<UserPick[]>([])
  const [gameResults, setGameResults] = useState<GameResult[]>([])
  const [userScores, setUserScores] = useState<Map<string, number>>(new Map())
  const [gameUserScores, setGameUserScores] = useState<Map<string, Map<string, number>>>(new Map())
  const [users, setUsers] = useState<User[]>([])
  
  // Function to fetch users from database
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched users:', data.users?.length || 0)
        if (data.users && Array.isArray(data.users)) {
          setUsers(data.users.map((u: any) => ({ id: u.id, name: u.name })))
          
          // Also update userScores from database
          const scoresMap = new Map<string, number>()
          data.users.forEach((u: any) => {
            if (u.totalSeasonPoints) {
              scoresMap.set(u.id, u.totalSeasonPoints)
            }
          })
          setUserScores((prev) => {
            // Merge with existing scores, keeping game-specific scores from localStorage
            const merged = new Map(prev)
            scoresMap.forEach((points, userId) => {
              merged.set(userId, points)
            })
            return merged
          })
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

  // Function to rotate pick order: move first person to the end
  const rotatePickOrder = useCallback(async () => {
    try {
      const orderResponse = await fetch('/api/pick-order')
      if (orderResponse.ok) {
        const { userIds } = await orderResponse.json()
        if (userIds && userIds.length > 0) {
          // Rotate: move first to end
          const rotated = [...userIds.slice(1), userIds[0]]
          
          // Update the pick order
          await fetch('/api/pick-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userIds: rotated }),
          })
          
          // Refresh users to get new order
          fetchUsers()
          console.log('Pick order rotated successfully')
        }
      }
    } catch (error) {
      console.error('Error rotating pick order:', error)
    }
  }, [fetchUsers])

  // Function to persist scores to database
  const persistScoresToDatabase = useCallback(async (scores: Map<string, number>) => {
    try {
      // Update each user's score in the database
      const updates = Array.from(scores.entries()).map(([userId, totalPoints]) =>
        fetch('/api/users/update-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, totalSeasonPoints: totalPoints }),
        })
      )
      
      await Promise.all(updates)
      console.log('Scores persisted to database')
    } catch (error) {
      console.error('Error persisting scores to database:', error)
    }
  }, [])

  // Load data from localStorage on mount
  useEffect(() => {
    const loadedGame = loadFromStorage<Game | null>(STORAGE_KEYS.currentGame, null)
    const loadedPicks = loadFromStorage<UserPick[]>(STORAGE_KEYS.currentPicks, [])
    const loadedResults = loadFromStorage<GameResult[]>(STORAGE_KEYS.gameResults, [])
    const loadedScores = loadFromStorage<Map<string, number>>(STORAGE_KEYS.userScores, new Map())
    const loadedGameUserScores = loadFromStorage<Map<string, Map<string, number>>>(STORAGE_KEYS.gameUserScores, new Map())
    
    fetchUsers()

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
    // Merge database scores with localStorage scores (localStorage takes precedence for game-specific scores)
    setUserScores(loadedScores)
    setGameUserScores(loadedGameUserScores)
    setIsLoading(false)
  }, [fetchUsers])
  
  // Refresh users when authentication state changes (e.g., after signup)
  useEffect(() => {
    if (!isLoading) {
      fetchUsers()
    }
  }, [currentUser, isLoading, fetchUsers])
  
  // Also fetch users on initial mount if not already loading
  useEffect(() => {
    if (!isLoading && users.length === 0) {
      fetchUsers()
    }
  }, [isLoading, users.length, fetchUsers])

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

      // Validate roster
      if (!roster || roster.length === 0) {
        console.error('Cannot simulate game: roster is empty')
        return
      }

      console.log('Starting simulation with roster size:', roster.length)

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
              result = parseRealGameResults(realResults, currentGame, roster, realResults.playByPlay)
            }
          }
        } catch (error) {
          console.log('Game not completed yet or error fetching results, will try historical data:', error)
        }
      }

      // If no real results, try to use historical data from last completed game
      if (!result && typeof window !== 'undefined') {
        try {
          console.log('Attempting to use historical game data for simulation...')
          const historicalResult = await fetchAndAdaptLastGame(roster, currentGame)
          if (historicalResult && historicalResult.playerStats && historicalResult.playerStats.length > 0) {
            console.log('Successfully adapted historical game data:', {
              playerStats: historicalResult.playerStats.length,
              teamPoints: historicalResult.teamPoints,
            })
            result = historicalResult
          } else {
            console.log('Historical data returned empty result, will use random simulation')
          }
        } catch (error) {
          console.log('Failed to fetch historical data, will use random simulation:', error)
        }
      }

      // If no historical data available, simulate the game randomly
      if (!result) {
        console.log('Using random simulation with roster:', roster.length, 'players')
        try {
          result = simulateGame(roster, currentGame)
          if (result && result.playerStats && result.playerStats.length > 0) {
            console.log('Random simulation complete:', {
              gameId: result.gameId,
              playerStats: result.playerStats.length,
              teamPoints: result.teamPoints,
            })
          } else {
            console.warn('Random simulation returned empty result, will create fallback')
            result = null
          }
        } catch (error) {
          console.error('Error in random simulation:', error)
          result = null
        }
      }

      // Ensure we have a valid result - create one if needed
      if (!result || !result.playerStats || result.playerStats.length === 0) {
        console.log('Creating fallback simulation result', {
          result: result ? 'exists but empty' : 'null',
          rosterSize: roster.length,
        })
        
        // Always create a valid result with stats for all roster players
        // This ensures we can calculate scores for all picks
        const fallbackStats: GamePlayerStats[] = roster.length > 0
          ? roster.map((p) => ({
              playerId: p.id,
              goals: [] as Array<{ isShorthanded: boolean; isOTGoal: boolean }>,
              assists: [] as Array<{ isShorthanded: boolean }>,
              position: p.position,
            }))
          : []
        
        // Generate some random goals/assists for realism
        if (roster.length > 0) {
          const teamGoals = Math.floor(Math.random() * 5) + 2 // 2-6 goals
          const opponentGoals = Math.floor(Math.random() * 5) + 1 // 1-5 goals
          
          currentGame.teamGoals = teamGoals
          currentGame.opponentGoals = opponentGoals
          currentGame.wentToOT = teamGoals === opponentGoals
          currentGame.shootoutOccurred = currentGame.wentToOT && Math.random() > 0.5
          
          // Distribute goals randomly
          for (let i = 0; i < teamGoals; i++) {
            const randomPlayer = roster[Math.floor(Math.random() * roster.length)]
            const playerStats = fallbackStats.find((s) => s.playerId === randomPlayer.id)
            if (playerStats) {
              playerStats.goals.push({
                isShorthanded: Math.random() < 0.1,
                isOTGoal: currentGame.wentToOT && i === teamGoals - 1,
              })
            }
          }
          
          // Distribute assists (1-2 per goal)
          fallbackStats.forEach((stats) => {
            const goalCount = stats.goals.length
            for (let i = 0; i < goalCount; i++) {
              const numAssists = Math.random() < 0.7 ? 1 : 2
              for (let j = 0; j < numAssists; j++) {
                const randomPlayer = roster[Math.floor(Math.random() * roster.length)]
                const assistStats = fallbackStats.find((s) => s.playerId === randomPlayer.id)
                if (assistStats && assistStats !== stats) {
                  assistStats.assists.push({
                    isShorthanded: stats.goals[i]?.isShorthanded || false,
                  })
                }
              }
            }
          })
        }
        
        result = {
          gameId: currentGame.id,
          playerStats: fallbackStats,
          teamPoints: currentGame.teamGoals > 3 ? currentGame.teamGoals : 0,
          completedAt: new Date().toISOString(),
        }
        
        console.log('Fallback result created:', {
          gameId: result.gameId,
          playerStats: result.playerStats.length,
          teamGoals: currentGame.teamGoals,
          teamPoints: result.teamPoints,
        })
      }

      // Ensure result has the correct gameId
      if (result && result.gameId !== currentGame.id) {
        result = {
          ...result,
          gameId: currentGame.id,
        }
      }

      console.log('Simulation result:', {
        gameId: result?.gameId,
        playerStatsCount: result?.playerStats?.length || 0,
        teamPoints: result?.teamPoints,
      })

      // Calculate user scores for this game
      const gamePicks = currentPicks.filter((p) => p.gameId === currentGame.id)
      const scores = calculateUserScores(gamePicks, result, roster, currentGame)
      
      console.log('Calculated scores:', Array.from(scores.entries()))

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

      // Calculate updated scores for persistence
      const updatedScores = new Map(userScores)
      scores.forEach((points, userId) => {
        const currentTotal = updatedScores.get(userId) || 0
        updatedScores.set(userId, currentTotal + points)
      })

      // Update cumulative scores
      setUserScores(updatedScores)

      // Persist scores to database
      await persistScoresToDatabase(updatedScores)

      // Save results
      console.log('Saving game result:', {
        gameId: result!.gameId,
        currentGameId: currentGame.id,
        playerStats: result!.playerStats.length,
      })
      setGameResults((prev) => {
        const updated = [...prev, result!]
        console.log('Updated gameResults:', updated.length, 'results')
        return updated
      })
      setCurrentGame(completedGame)
      console.log('Game marked as completed:', completedGame.id, completedGame.status)

      // Automatically rotate pick order after game completion
      await rotatePickOrder()
    },
    [currentGame, currentPicks, userScores, persistScoresToDatabase, rotatePickOrder, fetchUsers],
  )

  const startNextGame = useCallback(
    async (
      opponent: string,
      opponentLogo: string,
      date: string,
      time: string,
      venue: string,
      isHome: boolean,
      nhlGameData?: any,
      rotateOrder: boolean = false,
    ) => {
      // Rotate pick order: move first person to the end (only if explicitly requested)
      // Note: This is now redundant since rotation happens automatically after game completion,
      // but keeping it for backward compatibility if needed
      if (rotateOrder) {
        await rotatePickOrder()
      }

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
    [fetchUsers],
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

