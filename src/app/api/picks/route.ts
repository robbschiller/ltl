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

    if (!userId || !gameId || !playerId) {
      return NextResponse.json(
        { error: 'userId, gameId, and playerId are required' },
        { status: 400 },
      )
    }

    await prisma.pick.upsert({
      where: {
        userId_gameId: {
          userId,
          gameId,
        },
      },
      update: {
        playerId,
        playerPosition: playerPosition || null,
      },
      create: {
        userId,
        gameId,
        playerId,
        playerPosition: playerPosition || null,
      },
    })

    const [picksCount, usersCount, game] = await Promise.all([
      prisma.pick.count({ where: { gameId } }),
      prisma.user.count(),
      prisma.game.findUnique({ where: { id: gameId } }),
    ])

    const picksLocked = usersCount > 0 && picksCount >= usersCount

    if (picksLocked && game && !game.lockedAt) {
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
