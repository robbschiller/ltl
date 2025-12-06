# 🏮 Light The Lamp

A Next.js fantasy hockey pick 'em game for the Detroit Red Wings. Pick players, simulate games, and compete with friends!

## Quick Start

Follow these steps to get the app running:

### 1. Install Prerequisites

Make sure you have:
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)

### 2. Clone and Install

```bash
git clone <repository-url>
cd light-the-lamp
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
touch .env
```

Add to `.env`:
```env
DATABASE_URL="file:./dev.db"
```

**Note:** The database file will be created automatically when you run migrations.

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply database migrations
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

### 6. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000)

That's it! The app will automatically fetch tonight's Red Wings game and roster.

---

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Utility-first CSS framework
- **Prisma** - Database ORM with SQLite (schema defined, ready for persistence)
- **NHL API** - Real-time game data, rosters, and player stats
  - Uses `api-web.nhle.com/v1` for schedules, games, and rosters
  - Uses `api.nhle.com/stats/rest` for player season statistics
- **localStorage** - Client-side state persistence (current implementation)

## Detailed Setup Instructions

### What Gets Installed

The `npm install` command installs:
- Next.js and React
- Prisma and Prisma Client
- Tailwind CSS
- TypeScript
- Lucide React (icons)
- And other dependencies

### Database Setup Details

Running `npm run prisma:migrate` will:
- Create the SQLite database file at `prisma/dev.db`
- Create all tables (User, Pick, UserScore)
- Set up indexes and relationships

**Alternative:** If you just want to push the schema without creating a migration:

```bash
npx prisma db push
```

### Verify Database Setup (Optional)

Open Prisma Studio to view your database:

```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all tables
- Add/edit/delete records
- Inspect data

Press `Ctrl+C` to stop Prisma Studio when done.

## Project Structure

```
light-the-lamp/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Pick, UserScore)
│   ├── migrations/            # Database migration files
│   └── dev.db                 # SQLite database (created after migration)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── nhl/           # NHL API routes
│   │   │       ├── game/      # Get tonight's game
│   │   │       ├── roster/    # Get team roster with stats
│   │   │       ├── season/    # Get season schedule
│   │   │       └── game-results/  # Get completed game results
│   │   ├── dashboard/         # Dashboard page
│   │   ├── login/             # Login page
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── dashboard/         # Dashboard components
│   │   │   ├── NextGame.tsx   # Game info display
│   │   │   ├── PickOrder.tsx  # Pick interface with roster stats
│   │   │   └── GameResults.tsx # Results display
│   │   └── layout/           # Layout components (Navbar)
│   ├── contexts/
│   │   ├── AuthContext.tsx   # Authentication context
│   │   └── GameContext.tsx   # Game state management (localStorage)
│   └── lib/
│       ├── nhlApi.ts         # NHL API client utilities
│       ├── prisma.ts         # Prisma client singleton
│       ├── gameSimulator.ts  # Game simulation & scoring logic
│       ├── parseGameResults.ts  # Parse real NHL game results
│       └── types.ts          # TypeScript interfaces
├── .env                       # Environment variables (create this)
├── package.json              # Dependencies and scripts
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
└── tailwind.config.js        # Tailwind CSS configuration
```

## Available Scripts

### Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database (Prisma)

```bash
npm run prisma:generate   # Generate Prisma Client
npm run prisma:migrate    # Create and apply migrations
npm run prisma:studio     # Open Prisma Studio (database GUI)
```

### Manual Prisma Commands

```bash
npx prisma generate              # Generate Prisma Client
npx prisma migrate dev           # Create migration and apply
npx prisma migrate dev --name <name>  # Create named migration
npx prisma db push               # Push schema changes (no migration)
npx prisma studio                # Open Prisma Studio
npx prisma format                # Format schema file
```

## API Endpoints

### NHL API Routes

- **`GET /api/nhl/game`** - Get tonight's Red Wings game
  - Returns: Game details, opponent, date, time, venue
  - Query params: `date` (optional, YYYY-MM-DD format)

- **`GET /api/nhl/roster?team=DET`** - Get team roster with season stats
  - Returns: Full roster with goals, assists, points for each player
  - Automatically sorted by points (highest to lowest)

- **`GET /api/nhl/season?season=20252026&gameNumber=1`** - Get season schedule
  - Returns: All games for the season, or specific game by number
  - Query params: `season` (optional), `gameNumber` (optional)

- **`GET /api/nhl/game-results?gameId=2025020452`** - Get completed game results
  - Returns: Boxscore data with player stats for completed games
  - Used to pull real results instead of simulating

## Database Schema

The app uses a minimal schema with 3 models (Prisma schema defined, ready for future persistence):

### User
- Stores user information (id, name, email)
- One-to-one relationship with UserScore
- One-to-many relationship with Pick

### Pick
- Stores user picks for games
- References external `gameId` from NHL API
- `playerId` can be a player ID or `'team'`
- Unique constraint: one pick per user per game

### UserScore
- Stores cumulative season points per user
- Updated after each game simulation

**Note:** Currently using `localStorage` for state persistence. The Prisma schema is defined and ready when you want to add database persistence.

## Troubleshooting

### Database Issues

**Problem:** `Error: P1001: Can't reach database server`

**Solution:** Make sure you've run migrations:
```bash
npm run prisma:migrate
```

**Problem:** `Error: Migration failed`

**Solution:** Reset the database (⚠️ **WARNING:** This deletes all data):
```bash
npx prisma migrate reset
```

### Port Already in Use

**Problem:** `Error: Port 3000 is already in use`

**Solution:** Use a different port:
```bash
PORT=3001 npm run dev
```

### Prisma Client Not Generated

**Problem:** `Error: Cannot find module '@prisma/client'`

**Solution:** Generate Prisma Client:
```bash
npm run prisma:generate
```

### Module Not Found Errors

**Problem:** Import errors after adding new files

**Solution:** Restart the dev server:
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Development Tips

1. **Hot Reload**: Next.js automatically reloads when you save files
2. **TypeScript Errors**: Check the terminal for type errors
3. **Database Changes**: After modifying `schema.prisma`, run `npm run prisma:migrate`
4. **View Database**: Use `npm run prisma:studio` to inspect data
5. **API Routes**: Test API routes:
   - `http://localhost:3000/api/nhl/game` - Get tonight's game
   - `http://localhost:3000/api/nhl/roster?team=DET` - Get roster with stats
   - `http://localhost:3000/api/nhl/season` - Get season schedule
   - `http://localhost:3000/api/nhl/game-results?gameId=2025020452` - Get game results
6. **Clear Game State**: Clear localStorage to reset all game data and scores
7. **Player Stats**: Roster is automatically sorted by points (highest to lowest)

## Features

### Game Management
- **Real NHL Game Data**: Automatically fetches tonight's Red Wings game from the NHL API
- **Real Roster & Stats**: Displays current roster with real season statistics (goals, assists, points)
- **Game Simulation**: Simulates games with realistic player stats, or uses real results when available
- **Sequential Game Progression**: Move through games sequentially

### Scoring System

#### Goalies
- **5 points** for a shutout
- **3 points** for allowing 1-2 goals
- **0 points** for 3+ goals against
- **5 points** per assist
- Empty netters and shootout goals don't count against goalies

#### Forwards
- **2 points** per regulation goal
- **+5 bonus points** for OT goals (7 total for OT goals!)
- **1 point** per assist
- Points **doubled** for shorthanded goals/assists

#### Defensemen
- **3 points** per regulation goal
- **+5 bonus points** for OT goals (8 total for OT goals!)
- **1 point** per assist
- Points **doubled** for shorthanded goals/assists

#### The Team
- **1 point per goal past 3** (4 goals = 4 points, 5 goals = 5 points, etc.)

### Data Sources
- **Game Data**: Fetched from NHL Web API (`api-web.nhle.com/v1`)
- **Player Stats**: Fetched from NHL Stats API (`api.nhle.com/stats/rest`)
- **Current State**: Uses `localStorage` for game state persistence
- **Database**: Prisma schema ready for future persistence layer

## Next Steps

Once the app is running:

1. Navigate to the dashboard
2. The app will automatically fetch tonight's Red Wings game from the NHL API
3. The current roster with real season stats will be loaded automatically
4. Make picks in order (users take turns selecting players or "The Team")
5. Simulate the game (or use real results if the game is completed)
6. View results and cumulative scores
7. Move to the next game when ready

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [NHL API Reference](https://github.com/Zmalski/NHL-API-Reference)
- [NHL Web API Documentation](https://api-web.nhle.com/v1/doc)

## Support

If you encounter issues:

1. Check that all prerequisites are installed
2. Verify `.env` file exists with `DATABASE_URL`
3. Ensure migrations have been run
4. Check the terminal for error messages
5. Try resetting the database (⚠️ deletes data): `npx prisma migrate reset`
