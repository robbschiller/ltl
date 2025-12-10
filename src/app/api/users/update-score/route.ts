import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId, totalSeasonPoints } = await request.json()

    if (!userId || typeof totalSeasonPoints !== 'number') {
      return NextResponse.json(
        { error: 'userId and totalSeasonPoints are required' },
        { status: 400 }
      )
    }

    // Update or create UserScore
    await prisma.userScore.upsert({
      where: { userId },
      update: {
        totalSeasonPoints,
      },
      create: {
        userId,
        totalSeasonPoints,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating user score:', error)
    return NextResponse.json(
      { error: 'Failed to update user score' },
      { status: 500 }
    )
  }
}

