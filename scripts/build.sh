#!/bin/bash
set -e

# Use POSTGRES_PRISMA_URL if DATABASE_URL is not set (for Vercel Postgres)
export DATABASE_URL=${DATABASE_URL:-$POSTGRES_PRISMA_URL}

# Run migrations
npx prisma migrate deploy

# Build Next.js
next build

