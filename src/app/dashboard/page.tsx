"use client"

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { NextGame } from '@/components/dashboard/NextGame'
import { PickOrder } from '@/components/dashboard/PickOrder'

export default function Dashboard() {
  const { currentUser } = useAuth()

  // Mock next game data
  const nextGame = {
    id: '1',
    opponent: 'Toronto Maple Leafs',
    opponentLogo:
      'https://upload.wikimedia.org/wikipedia/en/thumb/b/b6/Toronto_Maple_Leafs_2016_logo.svg/1200px-Toronto_Maple_Leafs_2016_logo.svg.png',
    date: 'Tonight',
    time: '7:00 PM EST',
    venue: 'Little Caesars Arena',
    isHome: true,
  }

  // Mock Red Wings roster
  const roster = [
    {
      id: '1',
      name: 'Dylan Larkin',
      number: '71',
      position: 'C',
    },
    {
      id: '2',
      name: 'Lucas Raymond',
      number: '23',
      position: 'LW',
    },
    {
      id: '3',
      name: 'Alex DeBrincat',
      number: '93',
      position: 'RW',
    },
    {
      id: '4',
      name: 'Moritz Seider',
      number: '53',
      position: 'D',
    },
    {
      id: '5',
      name: 'Patrick Kane',
      number: '88',
      position: 'RW',
    },
    {
      id: '6',
      name: 'J.T. Compher',
      number: '18',
      position: 'C',
    },
    {
      id: '7',
      name: 'Ben Chiarot',
      number: '8',
      position: 'D',
    },
    {
      id: '8',
      name: 'Ville Husso',
      number: '35',
      position: 'G',
    },
    {
      id: '9',
      name: 'Andrew Copp',
      number: '82',
      position: 'C',
    },
    {
      id: '10',
      name: 'David Perron',
      number: '57',
      position: 'RW',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <NextGame game={nextGame} />
        <PickOrder currentUserId={currentUser?.uid || ''} roster={roster} />
      </div>
    </div>
  )
}

