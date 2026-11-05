# GwgCommunity Next Engine

This is the isolated Node.js + Next.js implementation of GwgCommunity.
The Django/Python engine remains at the repository root under `python_app/`.

## Runtime

- Node.js 24
- Next.js 15
- React 19
- PostgreSQL + Drizzle ORM
- Better Auth

## Development

```sh
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
corepack pnpm db:migrate
corepack pnpm dev
```

Run these checks before using the engine:

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm db:check
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm build
```

The engine is intentionally isolated: its database, authentication cookies,
environment variables, build output, and test commands are separate from the
Python engine.
