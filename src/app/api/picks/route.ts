import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
    }

    const picks = await prisma.pick.findMany({
      where: { gameId },
      select: {
        userId: true,
        gameId: true,
        playerId: true,
        playerPosition: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ picks }, { status: 200 })
  } catch (error) {
    console.error('Error fetching picks:', error)
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, gameId, playerId, playerPosition } = await request.json()
    const authUserId = request.cookies.get('userId')?.value

    if (!authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!gameId || !playerId) {
      return NextResponse.json(
        { error: 'gameId and playerId are required' },
        { status: 400 },
      )
    }

    if (userId && userId !== authUserId) {
      return NextResponse.json({ error: 'Cannot pick for another user' }, { status: 403 })
    }

    const game = await prisma.game.findUnique({ where: { id: gameId } })
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (game.status === 'completed' || game.lockedAt) {
      return NextResponse.json({ error: 'Picks are locked' }, { status: 403 })
    }

    const pickOrder = await prisma.pickOrder.findFirst({
      orderBy: { updatedAt: 'desc' },
    })

    if (pickOrder?.userIds) {
      try {
        const userIds = JSON.parse(pickOrder.userIds) as string[]
        const existingPicks = await prisma.pick.findMany({
          where: { gameId },
          select: { userId: true },
        })
        const pickedUserIds = new Set(existingPicks.map((pick) => pick.userId))
        const currentPicker = userIds.find((id) => !pickedUserIds.has(id))

        if (currentPicker && currentPicker !== authUserId) {
          return NextResponse.json({ error: 'Not your turn to pick' }, { status: 403 })
        }
      } catch (error) {
        console.error('Error parsing pick order:', error)
      }
    }

    await prisma.pick.upsert({
      where: {
        userId_gameId: {
          userId: authUserId,
          gameId,
        },
      },
      update: {
        playerId,
        playerPosition: playerPosition || null,
      },
      create: {
        userId: authUserId,
        gameId,
        playerId,
        playerPosition: playerPosition || null,
      },
    })

    const [picksCount, usersCount] = await Promise.all([
      prisma.pick.count({ where: { gameId } }),
      prisma.user.count(),
    ])

    const picksLocked = usersCount > 0 && picksCount >= usersCount

    if (picksLocked && !game.lockedAt) {
      await prisma.game.update({
        where: { id: gameId },
        data: { lockedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error saving pick:', error)
    return NextResponse.json({ error: 'Failed to save pick' }, { status: 500 })
  }
}
