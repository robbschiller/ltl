import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'timothy.schiller@gmail.com').toLowerCase()

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const normalizedEmail = email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user and automatically create UserScore
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        isAdmin: normalizedEmail === ADMIN_EMAIL,
        score: {
          create: {
            totalSeasonPoints: 0,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    })

    // Create a simple session (using a cookie with user ID)
    // In production, you'd want to use a proper session library or JWT
    const response = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } },
      { status: 201 }
    )

    // Set a cookie with the user ID (simple approach)
    // In production, use httpOnly, secure, sameSite flags
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

