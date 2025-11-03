import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"
import { fetchRedWingsRoster202526 } from "@/lib/nhl-api"

// GET: Fetch all active players
// If refresh=true, fetches from NHL API and updates database
// Otherwise, returns players from database
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // If refresh requested, fetch from NHL API and update database
    if (refresh) {
      console.log('🔄 Refreshing roster from NHL API...')
      const roster = await fetchRedWingsRoster202526('current')

      const players = []

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
          players.push({
            id: updated.id,
            name: updated.name,
            number: updated.number,
            position: updated.position,
            isActive: updated.isActive
          })
        } else {
          // Create new player
          const created = await prisma.player.create({
            data: playerData
          })
          players.push({
            id: created.id,
            name: created.name,
            number: created.number,
            position: created.position,
            isActive: created.isActive
          })
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

      // Return refreshed players
      return NextResponse.json({ 
        players,
        refreshed: true
      }, { status: 200 })
    }

    // Otherwise, return players from database
    const players = await prisma.player.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { position: 'asc' },
        { number: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ players }, { status: 200 })
  } catch (error) {
    console.error("Get players error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

