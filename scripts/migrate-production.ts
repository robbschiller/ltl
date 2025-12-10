import { execSync } from 'child_process'

// This script runs migrations for production
// It's safe to run multiple times (migrate deploy only runs pending migrations)

try {
  console.log('Running Prisma migrations for production...')
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  console.log('✅ Migrations completed successfully')
} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}

