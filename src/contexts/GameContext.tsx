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
    
    // Filter out any gameResults that don't have playerStats (corrupted data)
    const validGameResults = loadedResults.filter((result) => {
      if (!result.playerStats || result.playerStats.length === 0) {
        console.warn('[GAME-CONTEXT] Filtering out invalid gameResult (no playerStats):', {
          gameId: result.gameId,
          resultKeys: Object.keys(result),
        })
        return false
      }
      return true
    })
    
    if (validGameResults.length !== loadedResults.length) {
      console.warn(`[GAME-CONTEXT] Filtered out ${loadedResults.length - validGameResults.length} invalid gameResults`)
      // Save the cleaned results back to localStorage
      saveToStorage(STORAGE_KEYS.gameResults, validGameResults)
    }
    
    setGameResults(validGameResults)
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

      console.log('[SIMULATE] Starting - fetching last Red Wings game...')

      // Get the last completed Red Wings game and use its player stats
      let result: GameResult | null = null
      let updatedGameValues: Partial<Game> | null = null
      
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch('/api/nhl/last-game-boxscore')
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error('[SIMULATE] Failed to fetch:', response.status, errorText)
            alert('Failed to fetch last game data. Please try again.')
            return
          }
          
          const lastGameData = await response.json()
          
          if (!lastGameData.boxscore) {
            console.error('[SIMULATE] No boxscore data')
            alert('No boxscore data available for the last game.')
            return
          }
          
          // Create a game object from the schedule game data for accurate scores
          const scheduleGame = lastGameData.game
          const isHome = scheduleGame?.homeTeam?.abbrev === 'DET'
          const gameForParsing: Game = {
            ...currentGame,
            isHome: isHome,
            teamGoals: lastGameData.scores?.redWingsScore || 0,
            opponentGoals: lastGameData.scores?.opponentScore || 0,
          }
          
          result = parseRealGameResults(
            {
              boxscore: lastGameData.boxscore,
              landing: lastGameData.boxscore,
              playByPlay: lastGameData.playByPlay,
              game: scheduleGame,
            },
            gameForParsing,
            roster,
            lastGameData.playByPlay
          )
          
          if (!result || !result.playerStats || result.playerStats.length === 0) {
            console.error('[SIMULATE] ERROR: No player stats!', {
              hasResult: !!result,
              playerStatsLength: result?.playerStats?.length || 0,
            })
            alert('No player stats found in the last game data.')
            return
          }
          
          // Store the updated game values to use later
          updatedGameValues = {
            teamGoals: gameForParsing.teamGoals,
            opponentGoals: gameForParsing.opponentGoals,
            wentToOT: gameForParsing.wentToOT,
            shootoutOccurred: gameForParsing.shootoutOccurred,
            emptyNetGoals: gameForParsing.emptyNetGoals,
          }
          
          console.log('[SIMULATE] Success:', {
            playerStats: result.playerStats.length,
            teamPoints: result.teamPoints,
            scores: updatedGameValues,
          })
        } catch (error) {
          console.error('[SIMULATE] Error:', error)
          alert('Error fetching last game data. Please try again.')
          return
        }
      } else {
        console.error('[SIMULATE] Cannot fetch: window undefined')
        return
      }

      // Ensure result has the correct gameId
      if (result && result.gameId !== currentGame.id) {
        result = {
          ...result,
          gameId: currentGame.id,
        }
      }

      // Calculate user scores for this game
      const gamePicks = currentPicks.filter((p) => p.gameId === currentGame.id)
      const scores = calculateUserScores(gamePicks, result, roster, currentGame)

      // Update game status - use the updated game values if we have them
      const completedGame: Game = {
        ...currentGame,
        status: 'completed',
        ...(updatedGameValues || {}),
      }
      
      console.log('Completed game scores:', {
        teamGoals: completedGame.teamGoals,
        opponentGoals: completedGame.opponentGoals,
        wentToOT: completedGame.wentToOT,
      })

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

      // Verify result has player stats before saving
      if (!result || !result.playerStats || result.playerStats.length === 0) {
        console.error('[SIMULATE] ERROR: Result has no player stats!', {
          hasResult: !!result,
          playerStatsLength: result?.playerStats?.length || 0,
          resultKeys: result ? Object.keys(result) : [],
        })
        alert('Error: No player stats found in game result. Please try again.')
        return
      }

      // Save results - verify player stats are included
      const resultToSave = {
        ...result,
        playerStats: result.playerStats, // Explicitly ensure playerStats is included
      }
      
      console.log('[SIMULATE] Saving result with', resultToSave.playerStats.length, 'player stats')
      
      setGameResults((prev) => {
        const updated = [...prev, resultToSave]
        // Verify it was saved correctly
        const saved = updated.find(r => r.gameId === resultToSave.gameId)
        if (saved) {
          console.log('[SIMULATE] Verified saved result has', saved.playerStats?.length || 0, 'player stats')
        }
        return updated
      })
      setCurrentGame(completedGame)

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

