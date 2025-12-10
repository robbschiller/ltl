"use client"

import React, { useState, createContext, useContext, useEffect } from 'react'

interface AuthContextType {
  currentUser: {
    uid: string
    displayName: string
    email: string
  } | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<{
    uid: string
    displayName: string
    email: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        if (data.user) {
          setCurrentUser({
            uid: data.user.id,
            displayName: data.user.name,
            email: data.user.email,
          })
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  async function signUp(email: string, password: string, displayName: string) {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name: displayName }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to sign up')
    }

    const data = await response.json()
    setCurrentUser({
      uid: data.user.id,
      displayName: data.user.name,
      email: data.user.email,
    })
  }

  async function signIn(email: string, password: string) {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to sign in')
    }

    const data = await response.json()
    setCurrentUser({
      uid: data.user.id,
      displayName: data.user.name,
      email: data.user.email,
    })
  }

  async function signOut() {
    await fetch('/api/auth/signout', {
      method: 'POST',
    })
    setCurrentUser(null)
  }

  const value = {
    currentUser,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

