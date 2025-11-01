import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)

    if (!user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
