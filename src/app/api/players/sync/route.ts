import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"
import { fetchRedWingsRoster202526 } from "@/lib/nhl-api"

// GET or POST: Sync players from NHL API to database
export async function GET(request: NextRequest) {
  return syncPlayers(request)
}

export async function POST(request: NextRequest) {
  return syncPlayers(request)
}

async function syncPlayers(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Fetch roster from NHL API using new documented endpoint
    console.log('🔄 Syncing players from NHL API...')
    const roster = await fetchRedWingsRoster202526()

    const createdPlayers = []
    const updatedPlayers = []

    for (const rosterPlayer of roster) {
      // Build full name from firstName and lastName
      const fullName = `${rosterPlayer.firstName.default} ${rosterPlayer.lastName.default}`.trim()
      
      // Position is already formatted correctly (Forward, Defense, Goalie)
      const position = rosterPlayer.position === 'Defense' ? 'Defense' : 
                       rosterPlayer.position === 'Goalie' ? 'Goalie' : 'Forward'

      const playerData = {
        name: fullName,
        number: rosterPlayer.sweaterNumber || null,
        position: position,
        isActive: true
      }

      // Try to find existing player by name and number
      const existingPlayer = await prisma.player.findFirst({
        where: {
          name: fullName,
          number: playerData.number
        }
      })

      if (existingPlayer) {
        // Update existing player
        const updated = await prisma.player.update({
          where: { id: existingPlayer.id },
          data: playerData
        })
        updatedPlayers.push(updated)
        console.log(`✅ Updated player: ${fullName} #${playerData.number || 'N/A'}`)
      } else {
        // Create new player
        const created = await prisma.player.create({
          data: playerData
        })
        createdPlayers.push(created)
        console.log(`✅ Created player: ${fullName} #${playerData.number || 'N/A'}`)
      }
    }

    // Mark players not in roster as inactive
    const activePlayerNames = roster.map(p => `${p.firstName.default} ${p.lastName.default}`.trim())
    await prisma.player.updateMany({
      where: {
        name: {
          notIn: activePlayerNames
        },
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    return NextResponse.json(
      {
        message: "Players synced successfully",
        created: createdPlayers.length,
        updated: updatedPlayers.length,
        players: [...createdPlayers, ...updatedPlayers]
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Sync players error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

