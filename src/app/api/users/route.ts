import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        score: {
          select: {
            totalSeasonPoints: true,
          },
        },
      },
      // Include users even if they don't have a score
    })

    // Get pick order
    const pickOrder = await prisma.pickOrder.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
    })

    let formattedUsers: Array<{
      id: string
      name: string
      totalSeasonPoints: number
    }>

    if (pickOrder && pickOrder.userIds) {
      try {
        // Order users according to pick order
        const userIds = JSON.parse(pickOrder.userIds) as string[]
        const userMap = new Map(allUsers.map((u) => [u.id, u]))
        
        // Add users in pick order
        const orderedUsers: typeof allUsers = []
        for (const userId of userIds) {
          const user = userMap.get(userId)
          if (user) {
            orderedUsers.push(user)
            userMap.delete(userId)
          }
        }
        
        // Add any remaining users (in case new users were added)
        userMap.forEach((user) => orderedUsers.push(user))

        formattedUsers = orderedUsers.map((user) => ({
          id: user.id,
          name: user.name,
          totalSeasonPoints: user.score?.totalSeasonPoints || 0,
        }))
      } catch (parseError) {
        console.error('Error parsing pick order:', parseError)
        // Fallback to creation order if parsing fails
        formattedUsers = allUsers.map((user) => ({
          id: user.id,
          name: user.name,
          totalSeasonPoints: user.score?.totalSeasonPoints || 0,
        }))
      }
    } else {
      // Fallback to creation order if no pick order exists
      formattedUsers = allUsers.map((user) => ({
        id: user.id,
        name: user.name,
        totalSeasonPoints: user.score?.totalSeasonPoints || 0,
      }))
    }

    console.log(`Returning ${formattedUsers.length} users`)
    return NextResponse.json({ users: formattedUsers }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    console.error('Error stack:', error?.stack)
    // Even on error, try to return at least some users
    try {
      const fallbackUsers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
        },
        take: 10,
      })
      return NextResponse.json({
        users: fallbackUsers.map((u) => ({
          id: u.id,
          name: u.name,
          totalSeasonPoints: 0,
        })),
      }, { status: 200 })
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to fetch users', details: error?.message },
        { status: 500 }
      )
    }
  }
}

