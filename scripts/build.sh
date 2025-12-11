#!/bin/bash
set -e

# Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
export DATABASE_URL=${DATABASE_URL:-$POSTGRES_PRISMA_URL}

echo "Resolving migration state..."

# Mark ALL SQLite migrations as applied (they're not needed - PostgreSQL migration handles everything)
# This tells Prisma to skip them and only apply the PostgreSQL migration
npx prisma migrate resolve --applied 20251206211710_init 2>/dev/null || true
npx prisma migrate resolve --applied 20251210022006_add_password_to_user 2>/dev/null || true
npx prisma migrate resolve --applied 20251210023629_add_pick_order 2>/dev/null || true

# Now deploy migrations (will apply PostgreSQL migration if not already applied)
echo "Deploying migrations..."
npx prisma migrate deploy

# Build Next.js
echo "Building Next.js..."
next build

