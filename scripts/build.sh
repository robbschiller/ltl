#!/bin/bash
set -e

# Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
export DATABASE_URL=${DATABASE_URL:-$POSTGRES_PRISMA_URL}

# Check if User table exists (meaning PostgreSQL migration was already applied)
TABLE_EXISTS=$(npx prisma db execute --stdin <<< "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User');" 2>/dev/null | grep -q "true" && echo "true" || echo "false") || echo "false"

if [ "$TABLE_EXISTS" = "true" ]; then
  echo "Tables already exist. Marking all migrations as applied..."
  # Mark all migrations as applied since tables already exist
  npx prisma migrate resolve --applied 20251206211710_init || true
  npx prisma migrate resolve --applied 20251210022006_add_password_to_user || true
  npx prisma migrate resolve --applied 20251210023629_add_pick_order || true
  npx prisma migrate resolve --applied 20250101000000_init_postgresql || true
else
  echo "Tables don't exist. Resolving failed SQLite migrations and applying PostgreSQL migration..."
  # Mark failed SQLite migrations as rolled back
  npx prisma migrate resolve --rolled-back 20251206211710_init || true
  
  # Mark other SQLite migrations as applied (they won't be applied, but this prevents errors)
  npx prisma migrate resolve --applied 20251210022006_add_password_to_user || true
  npx prisma migrate resolve --applied 20251210023629_add_pick_order || true
  
  # Now apply migrations (only PostgreSQL migration will actually run)
  npx prisma migrate deploy
fi

# Build Next.js
next build

