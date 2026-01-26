import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const authUserId = request.cookies.get('userId')?.value
    if (!authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const authUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { isAdmin: true },
    })

    if (!authUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
