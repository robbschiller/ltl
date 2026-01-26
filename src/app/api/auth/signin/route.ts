import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'timothy.schiller@gmail.com').toLowerCase()

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    let effectiveUser = user

    if (!user.isAdmin && user.email.toLowerCase() === ADMIN_EMAIL) {
      effectiveUser = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      })
    }

    // Create response with user data (excluding password)
    const response = NextResponse.json(
      {
        user: {
          id: effectiveUser.id,
          email: effectiveUser.email,
          name: effectiveUser.name,
          isAdmin: effectiveUser.isAdmin,
        },
      },
      { status: 200 }
    )

    // Set a cookie with the user ID
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error('Signin error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
}

