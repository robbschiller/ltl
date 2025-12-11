#!/bin/bash
set -e

# Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
export DATABASE_URL=${DATABASE_URL:-$POSTGRES_PRISMA_URL}

echo "Preparing migrations for PostgreSQL..."

# Temporarily move SQLite migrations out of the way
mkdir -p prisma/migrations_backup
mv prisma/migrations/20251206211710_init prisma/migrations_backup/ 2>/dev/null || true
mv prisma/migrations/20251210022006_add_password_to_user prisma/migrations_backup/ 2>/dev/null || true
mv prisma/migrations/20251210023629_add_pick_order prisma/migrations_backup/ 2>/dev/null || true

# Now deploy migrations (only PostgreSQL migration will be found)
echo "Deploying migrations..."
npx prisma migrate deploy || {
  # If deploy fails, restore migrations
  mv prisma/migrations_backup/* prisma/migrations/ 2>/dev/null || true
  rmdir prisma/migrations_backup 2>/dev/null || true
  exit 1
}

# Restore SQLite migrations (for local dev)
mv prisma/migrations_backup/* prisma/migrations/ 2>/dev/null || true
rmdir prisma/migrations_backup 2>/dev/null || true

# Build Next.js
echo "Building Next.js..."
next build

