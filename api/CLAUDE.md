# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`mini-shop/api` — a NestJS 12 + Prisma 7 REST API for a small multilingual (ar/en)
shop. It is an **early scaffold**: the Prisma data model is designed, but `src/`
still contains only the Nest starter (`AppController`/`AppService`) plus bootstrap
wiring. There are no feature modules, no migrations, and the git repo has **zero
commits** — everything is untracked on `master`.

`README.md` is the untouched NestJS starter README; ignore it as a source of truth.

## Commands

```bash
npm run start:dev            # watch-mode dev server (nest start --watch)
npm run build                # nest build -> dist/ (deleteOutDir: true)
npm run start:prod           # node dist/main
npm run lint                 # oxlint src/ test/   (oxlint, NOT eslint)
npm run format               # prettier --write

npm run test                 # vitest run  -> **/*.spec.ts
npm run test:e2e             # vitest run --config ./vitest.config.e2e.ts -> **/*.e2e-spec.ts
npm run test:cov
npx vitest run src/app.controller.spec.ts          # one file
npx vitest run -t 'should return "Hello World!"'   # one test by name
```

Vitest runs with `globals: true` (no importing `describe`/`it`) and
`vite-tsconfig-paths`, so tsconfig path aliases resolve in tests.

## ESM is not optional

`"type": "module"` + `module/moduleResolution: nodenext`. **Every relative import
must carry the `.js` extension**, including in tests and `test/app.e2e-spec.ts`:

```ts
import { AppService } from './app.service.js';
```

`Joi` must be default-imported (`import Joi from 'joi'`), not namespace-imported.

## Bootstrap contract (`src/main.ts`)

Two things silently shape every endpoint you add:

- **Global prefix `v1/api`** — routes live at `/v1/api/...` (e.g. the health check
  is `GET /v1/api/health`, per `requests.http`). The starter e2e test asserts
  `GET /` and will fail against this prefix.
- **Global `ValidationPipe`** with `whitelist`, `forbidNonWhitelisted`, `transform`.
  Any request body without a `class-validator`-decorated DTO is rejected, and
  unknown properties are a 400 — DTOs are mandatory, not a convention.

`main.ts` instantiates `new ConfigService()` **outside the DI container**, so it
reads raw `process.env` and does *not* see the Joi-applied defaults. Inside
providers, inject `ConfigService` instead.

## Environment

`ConfigModule.forRoot` in `src/app.module.ts` validates env with a **Joi schema**.
Adding a new env var requires adding it to that schema or the app boots fine and
the value is stripped; adding a *required* one without updating `.env` crashes at
startup. `APP_NAME` is required by the schema but missing from `.env.example` —
keep `.env.example` in sync when touching the schema.

`@nestjs/observe` is wired in: `createObserveModule()` in `app.module.ts` exports
`ObserveInstrument`, which `NestFactory.create` receives as `instrument`.

## Prisma 7

The datasource is Postgres with **no `url` in `schema.prisma`** — the connection
comes from a config file. Two config files currently exist and disagree:

| File | Style |
|---|---|
| `prisma7.config.ts` (root) | `defineConfig` from `prisma/config`, `datasource.url` from `DATABASE_URL` |
| `prisma/prisma.config.ts` | `definePrismaConfig` + `ormConfig` from `@prisma/orm-postgres/config` |

Neither is currently usable as-is: the **`prisma` CLI is not installed** (only
`@prisma/client` is a dependency) and `@prisma/orm-postgres` is absent from
`node_modules`. Resolve this before running any migration work — pick one config
file and delete the other rather than editing both.

The generator writes the client to `src/generated/prisma` (gitignored, and **not
yet generated** — `npx prisma generate` must run before any Prisma import
compiles). There is no `prisma/migrations/` directory yet.

Prisma skills are vendored at `.agents/skills/`, mirrored into `.claude/skills/`
and `.windsurf/skills/`, pinned by `skills-lock.json` (source: `prisma/skills` on
GitHub). Prefer those over guessing Prisma 7 API surface — v7 differs from v6.

## Data model (`prisma/schema.prisma`)

- **i18n by translation table**, not by column: `Product`/`Category` hold only
  locale-independent fields; names/descriptions live in `ProductTranslation` /
  `CategoryTranslation`, each uniquely keyed `(parentId, locale)` over the
  `Locale` enum (`ar`, `en`). Any product/category read that surfaces text must
  join the translation for the requested locale.
- **Auth**: `User` (with `Role` enum `USER`/`ADMIN`) plus `RefreshToken` storing a
  `tokenHash` (unique), not the token — rotation/revocation via `revokedAt`,
  cascade-deleted with the user. Env carries separate access/refresh JWT secrets
  and TTLs.
- `Product.price` is `Decimal(10,2)` — it comes back as a Prisma `Decimal`, not a
  JS number; don't do arithmetic on it as a float.
- `Product.category` is `onDelete: Restrict` (categories with products can't be
  deleted); `createdBy` is nullable.
- Field is spelled `expairsAt` on `RefreshToken` (typo baked into the schema) —
  match it or rename it deliberately with a migration.
