import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'timothy.schiller@gmail.com').toLowerCase()

const users = [
  { name: 'Timothy Schiller', email: ADMIN_EMAIL },
  { name: 'Rob Schiller', email: 'rob@example.com' },
  { name: 'Robb Schiller', email: 'robb@example.com' },
  { name: 'Jordan Schiller', email: 'jordan@example.com' },
  { name: 'Andrew Karp', email: 'andrew@example.com' },
  { name: 'Jason Ballein', email: 'jason@example.com' },
  { name: 'Pedro Carmo', email: 'pedro@example.com' },
  { name: 'Wilma Harris', email: 'wilma@example.com' },
]

async function createUsers() {
  console.log('Creating users...\n')
  
  const credentials: Array<{ name: string; email: string; password: string }> = []

  for (const userData of users) {
    // Generate a simple password based on the name
    const firstName = userData.name.split(' ')[0].toLowerCase()
    const password = `${firstName}123`
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    })

    if (existing) {
      console.log(`User ${userData.name} already exists, skipping...`)
      credentials.push({
        name: userData.name,
        email: userData.email,
        password: password,
      })
      continue
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user with UserScore
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        isAdmin: userData.email.toLowerCase() === ADMIN_EMAIL,
        score: {
          create: {
            totalSeasonPoints: 0,
          },
        },
      },
    })

    console.log(`✓ Created user: ${userData.name}`)
    credentials.push({
      name: userData.name,
      email: userData.email,
      password: password,
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log('USER CREDENTIALS')
  console.log('='.repeat(60) + '\n')
  
  credentials.forEach((cred, index) => {
    console.log(`${index + 1}. ${cred.name}`)
    console.log(`   Email: ${cred.email}`)
    console.log(`   Password: ${cred.password}`)
    console.log('')
  })
}

createUsers()
  .catch((e) => {
    console.error('Error creating users:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

