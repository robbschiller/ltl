# 🏮 Light The Lamp

A Next.js project with TypeScript, Tailwind CSS, and Prisma ORM.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Prisma** - Database ORM with SQLite
- **ESLint** - Code linting and formatting

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npx prisma migrate dev
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── lib/                 # Utility functions and configurations
│   └── prisma.ts       # Prisma client configuration
└── generated/           # Generated Prisma client
prisma/
├── schema.prisma       # Database schema
└── migrations/         # Database migrations
```

## Database

This project uses SQLite with Prisma ORM. The database file (`dev.db`) is created automatically when you run the first migration.

### Useful Prisma Commands

- `npx prisma studio` - Open Prisma Studio to view/edit data
- `npx prisma generate` - Generate Prisma client
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma db push` - Push schema changes to database

## Development

- The project uses TypeScript for type safety
- Tailwind CSS is configured for styling
- ESLint is set up for code quality
- Hot reload is enabled for development

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)