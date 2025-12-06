"use client"

import React from 'react'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import Image from 'next/image'

interface NextGameProps {
  game: {
    opponent: string
    opponentLogo: string
    date: string
    time: string
    venue: string
    isHome: boolean
  }
}

export function NextGame({ game }: NextGameProps) {
  return (
    <div className="backdrop-blur-xl bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl mb-8">
      <h2 className="text-xl font-semibold text-gray-400 mb-6 uppercase tracking-wide">
        Next Game
      </h2>
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-8">
          <div className="text-center">
            <Image
              src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Detroit_Red_Wings_logo.svg/1200px-Detroit_Red_Wings_logo.svg.png"
              alt="Red Wings"
              width={80}
              height={80}
              className="mb-2"
            />
            <p className="text-white font-semibold text-sm">Red Wings</p>
          </div>
          <div className="text-2xl font-bold text-white">vs</div>
          <div className="text-center">
            <Image
              src={game.opponentLogo}
              alt={game.opponent}
              width={80}
              height={80}
              className="mb-2"
            />
            <p className="text-white font-semibold text-sm">{game.opponent}</p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <div className="flex items-center justify-center md:justify-end text-gray-300 mb-2">
            <CalendarIcon className="h-5 w-5 mr-2" />
            <span className="text-lg font-medium">
              {game.date} • {game.time}
            </span>
          </div>
          <div className="flex items-center justify-center md:justify-end text-gray-400 text-sm">
            <MapPinIcon className="h-4 w-4 mr-2" />
            <span>{game.venue}</span>
          </div>
          <span
            className={`mt-3 inline-block px-4 py-2 text-sm rounded-full font-medium ${
              game.isHome
                ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                : 'bg-white/10 text-gray-300 border border-white/20'
            }`}
          >
            {game.isHome ? 'Home Game' : 'Away Game'}
          </span>
        </div>
      </div>
    </div>
  )
}

