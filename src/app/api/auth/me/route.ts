import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'timothy.schiller@gmail.com').toLowerCase()

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('userId')?.value

    if (!userId) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    })

    if (!user) {
      // Clear invalid cookie
      const response = NextResponse.json({ user: null }, { status: 200 })
      response.cookies.delete('userId')
      return response
    }

    let effectiveUser = user

    if (user && !user.isAdmin && user.email.toLowerCase() === ADMIN_EMAIL) {
      effectiveUser = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          createdAt: true,
        },
      })
    }

    return NextResponse.json({ user: effectiveUser }, { status: 200 })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}

