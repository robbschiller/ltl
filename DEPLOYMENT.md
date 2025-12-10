# Deployment Guide

## Production Database Setup

This application requires a PostgreSQL database for production (Vercel doesn't support SQLite).

### Option 1: Vercel Postgres (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to the "Storage" tab
3. Click "Create Database" → Select "Postgres"
4. Create a new Postgres database
5. The `DATABASE_URL` environment variable will be automatically set

### Option 2: External PostgreSQL Database

You can use any PostgreSQL provider:
- **Neon** (Free tier available): https://neon.tech
- **Supabase** (Free tier available): https://supabase.com
- **Railway** (Free tier available): https://railway.app
- **AWS RDS**, **Google Cloud SQL**, etc.

1. Create a PostgreSQL database on your chosen provider
2. Get the connection string (usually in the format: `postgresql://user:password@host:port/database`)
3. Add it as an environment variable in Vercel:
   - Go to your Vercel project → Settings → Environment Variables
   - Add `DATABASE_URL` with your PostgreSQL connection string

### Running Migrations

Migrations run automatically during the build process via the `build` script in `package.json`:

```json
"build": "prisma migrate deploy && next build"
```

This ensures your production database schema is always up to date.

### Seeding Production Database (Optional)

If you want to seed your production database with initial data:

1. Set up your database and `DATABASE_URL` environment variable
2. Run the seed script:
   ```bash
   npm run prisma:seed
   ```

**Note:** Make sure your `DATABASE_URL` points to your production database before running the seed script!

## Local Development

For local development, you can:

1. **Use a local PostgreSQL database** (recommended for consistency)
2. **Use a free cloud PostgreSQL** (Neon, Supabase, etc.) for development
3. **Use SQLite** (if you temporarily change the schema back to SQLite)

To use SQLite locally:
1. Change `provider = "postgresql"` to `provider = "sqlite"` in `prisma/schema.prisma`
2. Set `DATABASE_URL="file:./dev.db"` in your `.env` file
3. Run `npm run prisma:migrate` to create migrations

**Note:** SQLite and PostgreSQL have different syntax, so you'll need separate migrations for each.

