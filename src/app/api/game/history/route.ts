import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      where: { finalizedAt: { not: null } },
      orderBy: { finalizedAt: 'desc' },
    })

    return NextResponse.json({ games }, { status: 200 })
  } catch (error) {
    console.error('Error fetching game history:', error)
    return NextResponse.json({ error: 'Failed to fetch game history' }, { status: 500 })
  }
}
