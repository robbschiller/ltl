"use client"

import React, { useState, createContext, useContext } from 'react'

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
  // Mock user for demo purposes
  const [currentUser] = useState({
    uid: 'demo-user-123',
    displayName: 'Hockey Fan',
    email: 'demo@example.com',
  })

  const [loading] = useState(false)

  async function signUp(email: string, password: string, displayName: string) {
    // No-op for demo
  }

  async function signIn(email: string, password: string) {
    // No-op for demo
  }

  async function signOut() {
    // No-op for demo
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

