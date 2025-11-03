"use client"

import { CheckIcon, ClockIcon, LockIcon, TrophyIcon } from "lucide-react"

interface Member {
  userId: string
  displayName: string
  hasPicked: boolean
  pick?: {
    playerId: string
    playerName: string
    playerNumber: number | null
  }
  rank: number
  totalPoints: number
  isCurrentUser?: boolean
}

interface LeagueMembersProps {
  members: Member[]
  nextGame?: {
    id: string
    isLocked: boolean
  } | null
}

export function LeagueMembers({ members, nextGame }: LeagueMembersProps) {
  if (!members || members.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">League Members</h2>
        <p className="text-gray-400">No members in this league.</p>
      </div>
    )
  }

  const getStatusIcon = (member: Member) => {
    if (!nextGame || nextGame.isLocked) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
          <LockIcon className="h-4 w-4" />
        </div>
      )
    }

    if (member.hasPicked) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-300 border border-green-500/50">
          <CheckIcon className="h-4 w-4" />
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/50">
        <ClockIcon className="h-4 w-4" />
      </div>
    )
  }

  const getStatusText = (member: Member) => {
    if (!nextGame || nextGame.isLocked) {
      return "Locked"
    }

    if (member.hasPicked) {
      return `Picked: ${member.pick?.playerName || 'Unknown'}`
    }

    return "Pending"
  }

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-500/50'
    if (rank === 2) return 'bg-gray-400/20 text-gray-300 border-2 border-gray-400/50'
    if (rank === 3) return 'bg-orange-600/20 text-orange-300 border-2 border-orange-600/50'
    return 'bg-white/10 text-gray-300'
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <TrophyIcon className="h-6 w-6 mr-2 text-yellow-400" />
          League Members
        </h2>
        <span className="text-sm text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.userId}
            className={`backdrop-blur-xl p-4 rounded-2xl border transition-all ${
              member.isCurrentUser 
                ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${getRankBadgeColor(member.rank)}`}
                >
                  {member.rank}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${member.isCurrentUser ? 'text-white' : 'text-gray-200'}`}>
                    {member.displayName}
                    {member.isCurrentUser && (
                      <span className="ml-2 text-xs bg-red-500/30 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    {getStatusText(member)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {getStatusIcon(member)}
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{member.totalPoints}</p>
                  <p className="text-xs text-gray-400">points</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

