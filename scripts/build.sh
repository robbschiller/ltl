#!/bin/bash
set -e

# Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
export DATABASE_URL=${DATABASE_URL:-$POSTGRES_PRISMA_URL}

# Resolve any failed migrations first
npx prisma migrate resolve --rolled-back 20251206211710_init || true
npx prisma migrate resolve --rolled-back 20251210022006_add_password_to_user || true
npx prisma migrate resolve --rolled-back 20251210023629_add_pick_order || true

# Run migrations
npx prisma migrate deploy

# Build Next.js
next build

