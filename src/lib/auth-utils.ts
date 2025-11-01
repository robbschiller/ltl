import jwt from "jsonwebtoken"
import { prisma } from "./prisma"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"

export interface User {
  id: string
  email: string
  name?: string | null
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    })

    return user
  } catch (error) {
    return null
  }
}

export function createToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
}
