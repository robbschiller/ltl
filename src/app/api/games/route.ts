import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser } from "@/lib/auth-utils"

// GET: Fetch games (upcoming, past, or all)
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
    const status = searchParams.get('status') // 'upcoming', 'past', 'all', or specific status
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10

    const now = new Date()

    // Build where clause
    const where: any = {}

    if (status === 'upcoming') {
      where.gameDate = {
        gte: now
      }
      where.status = {
        in: ['scheduled', 'in_progress']
      }
    } else if (status === 'past') {
      where.gameDate = {
        lt: now
      }
      where.status = 'final'
    } else if (status && status !== 'all') {
      where.status = status
    }

    const games = await prisma.game.findMany({
      where,
      orderBy: {
        gameDate: status === 'upcoming' ? 'asc' : 'desc'
      },
      take: limit,
      include: {
        picks: {
          where: {
            userId: user.id
          },
          include: {
            player: {
              select: {
                id: true,
                name: true,
                number: true,
                position: true
              }
            },
            league: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ games }, { status: 200 })
  } catch (error) {
    console.error("Get games error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

