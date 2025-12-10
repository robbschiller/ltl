import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get the pick order (there should only be one)
    const pickOrder = await prisma.pickOrder.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
    })

    if (!pickOrder) {
      return NextResponse.json({ userIds: [] }, { status: 200 })
    }

    const userIds = JSON.parse(pickOrder.userIds) as string[]
    return NextResponse.json({ userIds }, { status: 200 })
  } catch (error) {
    console.error('Error fetching pick order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pick order' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userIds } = await request.json()

    if (!Array.isArray(userIds)) {
      return NextResponse.json(
        { error: 'userIds must be an array' },
        { status: 400 }
      )
    }

    // Get existing pick order or create new one
    const existing = await prisma.pickOrder.findFirst()

    if (existing) {
      await prisma.pickOrder.update({
        where: { id: existing.id },
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
    } else {
      await prisma.pickOrder.create({
        data: {
          userIds: JSON.stringify(userIds),
        },
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating pick order:', error)
    return NextResponse.json(
      { error: 'Failed to update pick order' },
      { status: 500 }
    )
  }
}

