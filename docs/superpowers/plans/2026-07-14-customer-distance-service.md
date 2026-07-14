# Customer Distance Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small, standalone, offline REST service over PostgreSQL that seeds 15 customers, geocodes their town via a local bundled reference table, and exposes two GET endpoints (row count, and a Budapest-distance-sorted list).

**Architecture:** A single pnpm/TypeScript package (no Nx, no monorepo) at the repo root. Prisma models a `customers` table (with a `name` UNIQUE constraint added for idempotent seeding). All geocoding and distance logic is written as pure, dependency-free functions so they are unit-testable offline. Fastify serves two GET routes through a `CustomerDataSource` interface that is dependency-injected — a real Prisma-backed adapter in production, a hand-written mock in unit tests (so route tests also run offline, no DB needed). Only the seed script and one integration-test file touch a real Postgres, started via docker-compose.

**Tech Stack:** TypeScript (strict, ESM, `moduleResolution: Bundler`), Node LTS, pnpm, Fastify 5, Prisma 6 + `@prisma/client`, PostgreSQL 16 (docker-compose, local only), Vitest, Zod, pino, dotenv.

## Global Constraints

These apply to every task below (copied verbatim/paraphrased from the spec and project docs):

- Offline only at runtime: no external geocoding API, no LLM call, ever (`docs/system-prompt.md`).
- Seed must be idempotent: running it twice must not duplicate rows.
- Town matching must be accent-insensitive, case-insensitive, and whitespace-trimmed; "Budapest" (and optionally its districts) must resolve to the capital.
- Unknown town → `lat`/`lon` = `null`. This is not an error: log it and continue, never crash.
- `GET /customers/count` → `{ "count": <integer> }`, must equal the actual row count.
- `GET /customers/by-distance` → ascending by distance to Budapest; Budapest customers first at `0` km; unknown-coordinate customers last with `distanceKm: null`; ties broken by `name`; `distanceKm` rounded to 1 decimal.
- Required unit test for the haversine distance calculation: a known distance (Budapest–Vienna ≈ 214 km), the 0 km case (Budapest itself), and null-coordinate handling.
- Out of scope: authentication, write endpoints beyond the seed, frontend, external geocoding/LLM calls.
- No `console.log` in product code — use the structured pino logger (`konvenciok.md`).
- TypeScript strict mode; `unknown` (not `any`) for untrusted input, narrowed safely; Zod validation at system boundaries.
- kebab-case file names, camelCase functions/variables, PascalCase types; small focused files; no mutation (spread into new objects).
- Conventional Commits (`feat`, `test`, `docs`, `chore`, `fix`, `refactor`), one small focused commit per completed step.
- **Every `git commit` must be immediately followed by `git push`** (explicit user instruction for this project).
- All work happens on the already-created and checked-out `harness/superpowers` branch, pushed to the public GitHub remote `origin` (`https://github.com/bordasm/CustomerCounterSorter`).

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working pnpm/TypeScript/Vitest toolchain that every later task builds on. Scripts: `dev`, `start`, `seed`, `typecheck`, `test`, `test:watch`, `test:integration`, `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "customer-counter-sorter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "seed": "tsx src/seed/seed-customers.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init",
    "prisma:migrate:deploy": "prisma migrate deploy"
  }
}
```

- [ ] **Step 2: Install production dependencies**

Run: `pnpm add fastify @prisma/client pino zod dotenv`
Expected: `dependencies` populated in `package.json`, `pnpm-lock.yaml` created.

- [ ] **Step 3: Install dev dependencies**

Run: `pnpm add -D typescript tsx vitest prisma @types/node`
Expected: `devDependencies` populated in `package.json`.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 6: Write `vitest.integration.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 7: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-customer_sorter}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-customer_sorter}
      POSTGRES_DB: ${POSTGRES_DB:-customer_sorter}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - customer_sorter_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-customer_sorter}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  customer_sorter_pgdata:
```

- [ ] **Step 8: Write `.env.example`**

```
DATABASE_URL=postgresql://customer_sorter:customer_sorter@localhost:5432/customer_sorter?schema=public
PORT=3000
POSTGRES_USER=customer_sorter
POSTGRES_PASSWORD=customer_sorter
POSTGRES_DB=customer_sorter
POSTGRES_PORT=5432
```

- [ ] **Step 9: Verify the toolchain**

Run:
```bash
pnpm install
pnpm test
docker compose -f docker-compose.yml config
```
Expected: `pnpm install` exits 0; `pnpm test` reports no test files but exits 0 (thanks to `passWithNoTests`); `docker compose config` prints the resolved compose config with no errors.

- [ ] **Step 10: Commit and push**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts vitest.integration.config.ts docker-compose.yml .env.example
git commit -m "chore: scaffold TypeScript/pnpm/Vitest/docker-compose toolchain"
git push
```

---

### Task 2: Town name normalization

**Files:**
- Create: `src/geocoding/normalize-city.ts`
- Test: `src/geocoding/normalize-city.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeCityName(raw: string): string` — used by Task 3's `geocodeCity`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeCityName } from './normalize-city';

describe('normalizeCityName', () => {
  it('should lowercase, trim, and collapse whitespace', () => {
    expect(normalizeCityName('  Vienna  ')).toBe('vienna');
  });

  it('should strip diacritics', () => {
    expect(normalizeCityName('Kraków')).toBe('krakow');
  });

  it('should be case-insensitive', () => {
    expect(normalizeCityName('KRAKÓW')).toBe('krakow');
  });

  it('should collapse internal repeated whitespace', () => {
    expect(normalizeCityName('New   York')).toBe('new york');
  });

  it('should map a Budapest district string to "budapest"', () => {
    expect(normalizeCityName('Budapest, XI. kerület')).toBe('budapest');
  });

  it('should map plain Budapest to "budapest"', () => {
    expect(normalizeCityName('Budapest')).toBe('budapest');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/geocoding/normalize-city.test.ts`
Expected: FAIL — `Cannot find module './normalize-city'` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

```ts
export function normalizeCityName(raw: string): string {
  const normalized = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  const firstWord = normalized.split(/[\s,]+/)[0];
  if (firstWord === 'budapest') {
    return 'budapest';
  }

  return normalized;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/geocoding/normalize-city.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit and push**

```bash
git add src/geocoding/normalize-city.ts src/geocoding/normalize-city.test.ts
git commit -m "feat: add accent/case-insensitive city name normalization"
git push
```

---

### Task 3: City reference table and geocoding lookup

**Files:**
- Create: `src/distance/budapest-coordinates.ts`
- Create: `src/geocoding/city-reference.ts`
- Create: `src/geocoding/geocode-city.ts`
- Test: `src/geocoding/geocode-city.test.ts`

**Interfaces:**
- Consumes: `normalizeCityName(raw: string): string` (Task 2).
- Produces:
  - `BUDAPEST_COORDINATES: { lat: number; lon: number }` — reused by Task 4 (tests) and Task 5.
  - `geocodeCity(rawTownName: string): { lat: number; lon: number } | null` — used by Task 7.

- [ ] **Step 1: Write `src/distance/budapest-coordinates.ts`**

```ts
export const BUDAPEST_COORDINATES = {
  lat: 47.4979,
  lon: 19.0402,
} as const;
```

- [ ] **Step 2: Write the failing test for geocoding**

```ts
import { describe, expect, it } from 'vitest';
import { geocodeCity } from './geocode-city';
import { BUDAPEST_COORDINATES } from '../distance/budapest-coordinates';

describe('geocodeCity', () => {
  it('should return coordinates for a known city', () => {
    expect(geocodeCity('Kraków')).toEqual({ lat: 50.0647, lon: 19.945 });
  });

  it('should be case- and diacritic-insensitive', () => {
    expect(geocodeCity('KRAKOW')).toEqual({ lat: 50.0647, lon: 19.945 });
  });

  it('should return null for an unknown city', () => {
    expect(geocodeCity('Atlantis')).toBeNull();
  });

  it('should resolve Budapest to the capital coordinates', () => {
    expect(geocodeCity('Budapest')).toEqual(BUDAPEST_COORDINATES);
  });

  it('should resolve a Budapest district to the capital coordinates', () => {
    expect(geocodeCity('Budapest, XI. kerület')).toEqual(BUDAPEST_COORDINATES);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/geocoding/geocode-city.test.ts`
Expected: FAIL — `Cannot find module './geocode-city'`.

- [ ] **Step 4: Write `src/geocoding/city-reference.ts`**

```ts
import { BUDAPEST_COORDINATES } from '../distance/budapest-coordinates';

export interface Coordinates {
  lat: number;
  lon: number;
}

export const CITY_REFERENCE: Record<string, Coordinates> = {
  budapest: BUDAPEST_COORDINATES,
  vienna: { lat: 48.2082, lon: 16.3738 },
  munich: { lat: 48.1351, lon: 11.582 },
  milan: { lat: 45.4642, lon: 9.19 },
  barcelona: { lat: 41.3851, lon: 2.1734 },
  lyon: { lat: 45.764, lon: 4.8357 },
  krakow: { lat: 50.0647, lon: 19.945 },
  prague: { lat: 50.0755, lon: 14.4378 },
  lisbon: { lat: 38.7223, lon: -9.1393 },
  amsterdam: { lat: 52.3676, lon: 4.9041 },
  stockholm: { lat: 59.3293, lon: 18.0686 },
  ljubljana: { lat: 46.0569, lon: 14.5058 },
  bucharest: { lat: 44.4268, lon: 26.1025 },
  dublin: { lat: 53.3498, lon: -6.2603 },
  copenhagen: { lat: 55.6761, lon: 12.5683 },
};
```

- [ ] **Step 5: Write `src/geocoding/geocode-city.ts`**

```ts
import { CITY_REFERENCE, type Coordinates } from './city-reference';
import { normalizeCityName } from './normalize-city';

export function geocodeCity(rawTownName: string): Coordinates | null {
  const key = normalizeCityName(rawTownName);
  return CITY_REFERENCE[key] ?? null;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/geocoding/geocode-city.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit and push**

```bash
git add src/distance/budapest-coordinates.ts src/geocoding/city-reference.ts src/geocoding/geocode-city.ts src/geocoding/geocode-city.test.ts
git commit -m "feat: add bundled city reference table and geocodeCity lookup"
git push
```

---

### Task 4: Haversine distance (required unit test)

**Files:**
- Create: `src/distance/haversine.ts`
- Test: `src/distance/haversine.test.ts`

**Interfaces:**
- Consumes: `BUDAPEST_COORDINATES` (Task 3, test only).
- Produces: `haversineKm(a: Coordinates, b: Coordinates): number` — used by Task 5.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { haversineKm } from './haversine';
import { BUDAPEST_COORDINATES } from './budapest-coordinates';

const VIENNA_COORDINATES = { lat: 48.2082, lon: 16.3738 };

describe('haversineKm', () => {
  it('should return 0 for identical coordinates (Budapest to itself)', () => {
    expect(haversineKm(BUDAPEST_COORDINATES, BUDAPEST_COORDINATES)).toBe(0);
  });

  it('should return approximately 214 km for Budapest to Vienna', () => {
    const distance = haversineKm(BUDAPEST_COORDINATES, VIENNA_COORDINATES);
    expect(distance).toBeGreaterThan(205);
    expect(distance).toBeLessThan(223);
  });

  it('should be symmetric', () => {
    const forward = haversineKm(BUDAPEST_COORDINATES, VIENNA_COORDINATES);
    const backward = haversineKm(VIENNA_COORDINATES, BUDAPEST_COORDINATES);
    expect(forward).toBe(backward);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/distance/haversine.test.ts`
Expected: FAIL — `Cannot find module './haversine'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Coordinates } from '../geocoding/city-reference';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/distance/haversine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit and push**

```bash
git add src/distance/haversine.ts src/distance/haversine.test.ts
git commit -m "test: add haversine distance calculation with Budapest-Vienna known-distance test"
git push
```

---

### Task 5: Distance-from-Budapest with null handling

**Files:**
- Create: `src/distance/distance-from-budapest.ts`
- Test: `src/distance/distance-from-budapest.test.ts`

**Interfaces:**
- Consumes: `haversineKm` (Task 4), `BUDAPEST_COORDINATES` (Task 3).
- Produces: `distanceFromBudapestKm(lat: number | null, lon: number | null): number | null` — used by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { distanceFromBudapestKm } from './distance-from-budapest';

describe('distanceFromBudapestKm', () => {
  it('should return 0 for Budapest coordinates', () => {
    expect(distanceFromBudapestKm(47.4979, 19.0402)).toBe(0);
  });

  it('should return approximately 214 km for Vienna, rounded to 1 decimal', () => {
    const distance = distanceFromBudapestKm(48.2082, 16.3738);
    expect(distance).not.toBeNull();
    expect(distance).toBeGreaterThan(205);
    expect(distance).toBeLessThan(223);
    expect(distance).toBe(Math.round((distance as number) * 10) / 10);
  });

  it('should return null when lat is null', () => {
    expect(distanceFromBudapestKm(null, 19.0402)).toBeNull();
  });

  it('should return null when lon is null', () => {
    expect(distanceFromBudapestKm(47.4979, null)).toBeNull();
  });

  it('should return null when both are null', () => {
    expect(distanceFromBudapestKm(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/distance/distance-from-budapest.test.ts`
Expected: FAIL — `Cannot find module './distance-from-budapest'`.

- [ ] **Step 3: Write the implementation**

```ts
import { BUDAPEST_COORDINATES } from './budapest-coordinates';
import { haversineKm } from './haversine';

export function distanceFromBudapestKm(lat: number | null, lon: number | null): number | null {
  if (lat === null || lon === null) {
    return null;
  }

  const km = haversineKm(BUDAPEST_COORDINATES, { lat, lon });
  return Math.round(km * 10) / 10;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/distance/distance-from-budapest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit and push**

```bash
git add src/distance/distance-from-budapest.ts src/distance/distance-from-budapest.test.ts
git commit -m "feat: add null-safe distance-from-Budapest calculation"
git push
```

---

### Task 6: Prisma schema, migration, and client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/db/prisma-client.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env var (from `.env`, created in this task from `.env.example`).
- Produces: the `customers` table in Postgres; `prisma: PrismaClient` singleton — used by Task 7 and Task 9.

- [ ] **Step 1: Create `.env` from the example**

Run: `cp .env.example .env`
Expected: `.env` exists (already gitignored).

- [ ] **Step 2: Start Postgres**

Run: `docker compose up -d`
Expected: container starts; check with `docker compose ps` that `postgres` is `healthy` (may take a few seconds — re-run `docker compose ps` if still `starting`).

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  telepules String
  lat       Decimal? @db.Decimal(9, 6)
  lon       Decimal? @db.Decimal(9, 6)
  budget    Int?
  note      String?

  @@map("customers")
}
```

- [ ] **Step 4: Run the migration**

Run: `pnpm prisma:migrate`
Expected: prompts complete non-interactively (name already supplied via `--name init`), creates `prisma/migrations/<timestamp>_init/migration.sql`, prints "Your database is now in sync with your schema", and runs `prisma generate` automatically.

- [ ] **Step 5: Verify the generated migration SQL**

Run: `cat prisma/migrations/*/migration.sql` (or open the file)
Expected: contains `CREATE TABLE "customers"` and a `CREATE UNIQUE INDEX` (or equivalent `UNIQUE` constraint) on `"name"`.

- [ ] **Step 6: Write `src/db/prisma-client.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (Prisma Client types are generated in `node_modules/.prisma/client` and picked up automatically).

- [ ] **Step 8: Commit and push**

```bash
git add prisma/schema.prisma prisma/migrations src/db/prisma-client.ts
git commit -m "feat: add Prisma schema, initial migration, and Prisma client singleton"
git push
```

Note: `prisma/migrations/` and `prisma/schema.prisma` are source-controlled (not gitignored); `.env` stays out of git per the existing `.gitignore`.

---

### Task 7: Idempotent seed script

**Files:**
- Create: `src/logger.ts`
- Create: `src/seed/raw-customer.ts`
- Create: `src/seed/build-customer-records.ts`
- Test: `src/seed/build-customer-records.test.ts`
- Create: `src/seed/seed-customers.ts`

**Interfaces:**
- Consumes: `geocodeCity` (Task 3), `prisma` (Task 6).
- Produces: `logger` (pino instance) — reused by Task 10 and Task 11; `buildCustomerRecords(rawCustomers: RawCustomer[]): { records: CustomerRecord[]; unmatchedTowns: string[] }`; the runnable `pnpm seed` script.

- [ ] **Step 1: Write `src/logger.ts`**

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});
```

- [ ] **Step 2: Write `src/seed/raw-customer.ts`**

```ts
import { z } from 'zod';

export const RawCustomerSchema = z.object({
  name: z.string().min(1),
  budget: z.number().int().nullable().optional(),
  location: z.object({
    city: z.string().min(1),
    countryCode: z.string().min(2),
  }),
  note: z.string().nullable().optional(),
});

export const RawCustomerListSchema = z.array(RawCustomerSchema);

export type RawCustomer = z.infer<typeof RawCustomerSchema>;
```

- [ ] **Step 3: Write the failing test for `build-customer-records`**

```ts
import { describe, expect, it } from 'vitest';
import { buildCustomerRecords } from './build-customer-records';
import type { RawCustomer } from './raw-customer';

describe('buildCustomerRecords', () => {
  it('should attach lat/lon when the town is known', () => {
    const raw: RawCustomer[] = [
      { name: 'Anna Kovács', budget: 850, location: { city: 'Budapest', countryCode: 'HU' }, note: 'note' },
    ];

    const result = buildCustomerRecords(raw);

    expect(result.records).toEqual([
      { name: 'Anna Kovács', telepules: 'Budapest', lat: 47.4979, lon: 19.0402, budget: 850, note: 'note' },
    ]);
    expect(result.unmatchedTowns).toEqual([]);
  });

  it('should set lat/lon to null and report the town when it is unknown', () => {
    const raw: RawCustomer[] = [
      { name: 'Test Person', budget: null, location: { city: 'Atlantis', countryCode: 'XX' }, note: null },
    ];

    const result = buildCustomerRecords(raw);

    expect(result.records).toEqual([
      { name: 'Test Person', telepules: 'Atlantis', lat: null, lon: null, budget: null, note: null },
    ]);
    expect(result.unmatchedTowns).toEqual(['Atlantis']);
  });

  it('should default a missing budget/note to null', () => {
    const raw: RawCustomer[] = [
      { name: 'No Budget', location: { city: 'Vienna', countryCode: 'AT' } },
    ];

    const result = buildCustomerRecords(raw);

    expect(result.records[0].budget).toBeNull();
    expect(result.records[0].note).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm exec vitest run src/seed/build-customer-records.test.ts`
Expected: FAIL — `Cannot find module './build-customer-records'`.

- [ ] **Step 5: Write `src/seed/build-customer-records.ts`**

```ts
import { geocodeCity } from '../geocoding/geocode-city';
import type { RawCustomer } from './raw-customer';

export interface CustomerRecord {
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface BuildCustomerRecordsResult {
  records: CustomerRecord[];
  unmatchedTowns: string[];
}

export function buildCustomerRecords(rawCustomers: RawCustomer[]): BuildCustomerRecordsResult {
  const unmatchedTowns: string[] = [];

  const records = rawCustomers.map((raw): CustomerRecord => {
    const coordinates = geocodeCity(raw.location.city);
    if (!coordinates) {
      unmatchedTowns.push(raw.location.city);
    }

    return {
      name: raw.name,
      telepules: raw.location.city,
      lat: coordinates?.lat ?? null,
      lon: coordinates?.lon ?? null,
      budget: raw.budget ?? null,
      note: raw.note ?? null,
    };
  });

  return { records, unmatchedTowns };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/seed/build-customer-records.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Write `src/seed/seed-customers.ts`**

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../db/prisma-client';
import { logger } from '../logger';
import { buildCustomerRecords } from './build-customer-records';
import { RawCustomerListSchema } from './raw-customer';

function readRawCustomers() {
  const seedPath = path.resolve(process.cwd(), 'docs/seed-customers.json');
  const fileContents = readFileSync(seedPath, 'utf-8');
  const parsedJson: unknown = JSON.parse(fileContents);
  return RawCustomerListSchema.parse(parsedJson);
}

async function main(): Promise<void> {
  const rawCustomers = readRawCustomers();
  const { records, unmatchedTowns } = buildCustomerRecords(rawCustomers);

  for (const town of unmatchedTowns) {
    logger.warn({ town }, 'no geocoding reference found for town; storing null lat/lon');
  }

  for (const record of records) {
    await prisma.customer.upsert({
      where: { name: record.name },
      update: {
        telepules: record.telepules,
        lat: record.lat,
        lon: record.lon,
        budget: record.budget,
        note: record.note,
      },
      create: record,
    });
  }

  logger.info({ count: records.length, unmatchedCount: unmatchedTowns.length }, 'seed completed');
}

main()
  .catch((error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ err }, 'seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Run the seed twice and verify idempotency**

Run:
```bash
pnpm seed
pnpm seed
docker compose exec postgres psql -U customer_sorter -d customer_sorter -c "SELECT count(*) FROM customers;"
```
Expected: both `pnpm seed` runs log `"seed completed"` with `count: 15, unmatchedCount: 0`; the `psql` count is `15` (not 30).

- [ ] **Step 10: Commit and push**

```bash
git add src/logger.ts src/seed/raw-customer.ts src/seed/build-customer-records.ts src/seed/build-customer-records.test.ts src/seed/seed-customers.ts
git commit -m "feat: add idempotent customer seed script with Zod-validated input"
git push
```

---

### Task 8: Sort customers by distance (pure logic)

**Files:**
- Create: `src/db/customer-data-source.ts`
- Create: `src/routes/sort-customers-by-distance.ts`
- Test: `src/routes/sort-customers-by-distance.test.ts`

**Interfaces:**
- Consumes: `distanceFromBudapestKm` (Task 5).
- Produces: `CustomerRow`, `CustomerDataSource` (interface, implemented by Task 9's adapter and by Task 10's test mocks), `CustomerWithDistance`, `sortCustomersByDistance(customers: CustomerRow[]): CustomerWithDistance[]` — used by Task 10.

- [ ] **Step 1: Write `src/db/customer-data-source.ts`**

```ts
export interface CustomerRow {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface CustomerDataSource {
  count(): Promise<number>;
  findMany(): Promise<CustomerRow[]>;
}
```

- [ ] **Step 2: Write the failing test for `sortCustomersByDistance`**

```ts
import { describe, expect, it } from 'vitest';
import { sortCustomersByDistance } from './sort-customers-by-distance';
import type { CustomerRow } from '../db/customer-data-source';

const customers: CustomerRow[] = [
  { id: 1, name: 'Zoltan', telepules: 'Vienna', lat: 48.2082, lon: 16.3738, budget: null, note: null },
  { id: 2, name: 'Csilla', telepules: 'Unknown', lat: null, lon: null, budget: null, note: null },
  { id: 3, name: 'Bela', telepules: 'Budapest', lat: 47.4979, lon: 19.0402, budget: null, note: null },
  { id: 4, name: 'Adam', telepules: 'Unknown2', lat: null, lon: null, budget: null, note: null },
];

describe('sortCustomersByDistance', () => {
  it('should sort ascending by distance, with Budapest first at 0 km', () => {
    const result = sortCustomersByDistance(customers);
    expect(result[0]).toMatchObject({ name: 'Bela', distanceKm: 0 });
    expect(result[1].name).toBe('Zoltan');
  });

  it('should place null-distance customers last, ordered by name', () => {
    const result = sortCustomersByDistance(customers);
    expect(result.slice(2).map((c) => c.name)).toEqual(['Adam', 'Csilla']);
    expect(result[2].distanceKm).toBeNull();
    expect(result[3].distanceKm).toBeNull();
  });

  it('should not mutate the input array', () => {
    const copy = [...customers];
    sortCustomersByDistance(customers);
    expect(customers).toEqual(copy);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/routes/sort-customers-by-distance.test.ts`
Expected: FAIL — `Cannot find module './sort-customers-by-distance'`.

- [ ] **Step 4: Write `src/routes/sort-customers-by-distance.ts`**

```ts
import { distanceFromBudapestKm } from '../distance/distance-from-budapest';
import type { CustomerRow } from '../db/customer-data-source';

export interface CustomerWithDistance extends CustomerRow {
  distanceKm: number | null;
}

export function sortCustomersByDistance(customers: CustomerRow[]): CustomerWithDistance[] {
  const withDistance = customers.map(
    (customer): CustomerWithDistance => ({
      ...customer,
      distanceKm: distanceFromBudapestKm(customer.lat, customer.lon),
    }),
  );

  return [...withDistance].sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.distanceKm === null) {
      return 1;
    }
    if (b.distanceKm === null) {
      return -1;
    }
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.name.localeCompare(b.name);
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/routes/sort-customers-by-distance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit and push**

```bash
git add src/db/customer-data-source.ts src/routes/sort-customers-by-distance.ts src/routes/sort-customers-by-distance.test.ts
git commit -m "feat: add pure sortCustomersByDistance with null-last, name-tiebreak ordering"
git push
```

---

### Task 9: Prisma-backed CustomerDataSource adapter

**Files:**
- Create: `src/db/prisma-customer-data-source.ts`

**Interfaces:**
- Consumes: `PrismaClient` type (`@prisma/client`), `CustomerDataSource`/`CustomerRow` (Task 8).
- Produces: `createPrismaCustomerDataSource(client: PrismaClient): CustomerDataSource` — used by Task 11.

- [ ] **Step 1: Write `src/db/prisma-customer-data-source.ts`**

```ts
import type { PrismaClient } from '@prisma/client';
import type { CustomerDataSource, CustomerRow } from './customer-data-source';

export function createPrismaCustomerDataSource(client: PrismaClient): CustomerDataSource {
  return {
    async count(): Promise<number> {
      return client.customer.count();
    },
    async findMany(): Promise<CustomerRow[]> {
      const rows = await client.customer.findMany();
      return rows.map(
        (row): CustomerRow => ({
          id: row.id,
          name: row.name,
          telepules: row.telepules,
          lat: row.lat === null ? null : row.lat.toNumber(),
          lon: row.lon === null ? null : row.lon.toNumber(),
          budget: row.budget,
          note: row.note,
        }),
      );
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (Prisma's generated `Customer` type has `lat`/`lon` typed as `Decimal | null`, exposing `.toNumber()`).

- [ ] **Step 3: Commit and push**

```bash
git add src/db/prisma-customer-data-source.ts
git commit -m "feat: add Prisma-backed CustomerDataSource adapter"
git push
```

---

### Task 10: Fastify server and routes

**Files:**
- Create: `src/routes/customers.ts`
- Create: `src/server.ts`
- Test: `src/routes/customers.test.ts`

**Interfaces:**
- Consumes: `CustomerDataSource` (Task 8), `sortCustomersByDistance` (Task 8), `logger` (Task 7).
- Produces: `registerCustomerRoutes(app: FastifyInstance, dataSource: CustomerDataSource): void`, `buildServer(dataSource: CustomerDataSource): FastifyInstance` — used by Task 11.

- [ ] **Step 1: Write the failing test for the routes**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../server';
import type { CustomerDataSource, CustomerRow } from '../db/customer-data-source';

function createMockDataSource(rows: CustomerRow[]): CustomerDataSource {
  return {
    count: async () => rows.length,
    findMany: async () => rows,
  };
}

describe('customer routes', () => {
  it('GET /customers/count should return the row count', async () => {
    const app = buildServer(
      createMockDataSource([
        { id: 1, name: 'Anna', telepules: 'Budapest', lat: 47.4979, lon: 19.0402, budget: 850, note: null },
        { id: 2, name: 'Lena', telepules: 'Vienna', lat: 48.2082, lon: 16.3738, budget: 950, note: null },
      ]),
    );

    const response = await app.inject({ method: 'GET', url: '/customers/count' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 2 });
  });

  it('GET /customers/by-distance should sort ascending with nulls last', async () => {
    const app = buildServer(
      createMockDataSource([
        { id: 1, name: 'Zoltan', telepules: 'Vienna', lat: 48.2082, lon: 16.3738, budget: null, note: null },
        { id: 2, name: 'Csilla', telepules: 'Unknown', lat: null, lon: null, budget: null, note: null },
        { id: 3, name: 'Bela', telepules: 'Budapest', lat: 47.4979, lon: 19.0402, budget: null, note: null },
        { id: 4, name: 'Adam', telepules: 'Unknown2', lat: null, lon: null, budget: null, note: null },
      ]),
    );

    const response = await app.inject({ method: 'GET', url: '/customers/by-distance' });
    const body = response.json() as Array<{ name: string; distanceKm: number | null }>;

    expect(response.statusCode).toBe(200);
    expect(body.map((c) => c.name)).toEqual(['Bela', 'Zoltan', 'Adam', 'Csilla']);
    expect(body[0].distanceKm).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/routes/customers.test.ts`
Expected: FAIL — `Cannot find module '../server'` (neither `server.ts` nor `routes/customers.ts` exist yet).

- [ ] **Step 3: Write `src/routes/customers.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { CustomerDataSource } from '../db/customer-data-source';
import { sortCustomersByDistance } from './sort-customers-by-distance';

export function registerCustomerRoutes(app: FastifyInstance, dataSource: CustomerDataSource): void {
  app.get('/customers/count', async () => {
    const count = await dataSource.count();
    return { count };
  });

  app.get('/customers/by-distance', async () => {
    const customers = await dataSource.findMany();
    return sortCustomersByDistance(customers);
  });
}
```

- [ ] **Step 4: Write `src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import type { CustomerDataSource } from './db/customer-data-source';
import { logger } from './logger';
import { registerCustomerRoutes } from './routes/customers';

export function buildServer(dataSource: CustomerDataSource): FastifyInstance {
  const app = Fastify({ loggerInstance: logger });
  registerCustomerRoutes(app, dataSource);
  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/routes/customers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit and push**

```bash
git add src/routes/customers.ts src/server.ts src/routes/customers.test.ts
git commit -m "feat: add Fastify server with GET /customers/count and /customers/by-distance"
git push
```

---

### Task 11: Entry point and integration verification

**Files:**
- Create: `src/index.ts`
- Create: `test/integration/customers-endpoints.integration.test.ts`

**Interfaces:**
- Consumes: `buildServer` (Task 10), `createPrismaCustomerDataSource` (Task 9), `prisma` (Task 6), `logger` (Task 7).
- Produces: the runnable service (`pnpm start`).

- [ ] **Step 1: Write `src/index.ts`**

```ts
import 'dotenv/config';
import { prisma } from './db/prisma-client';
import { createPrismaCustomerDataSource } from './db/prisma-customer-data-source';
import { logger } from './logger';
import { buildServer } from './server';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const dataSource = createPrismaCustomerDataSource(prisma);
  const app = buildServer(dataSource);

  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'server started');
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error({ err }, 'server failed to start');
  process.exitCode = 1;
});
```

- [ ] **Step 2: Write `test/integration/customers-endpoints.integration.test.ts`**

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma-client';
import { createPrismaCustomerDataSource } from '../../src/db/prisma-customer-data-source';
import { buildServer } from '../../src/server';

describe('customer endpoints (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /customers/count should return 15 after seeding', async () => {
    const app = buildServer(createPrismaCustomerDataSource(prisma));

    const response = await app.inject({ method: 'GET', url: '/customers/count' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 15 });

    await app.close();
  });

  it('GET /customers/by-distance should list Budapest first with distanceKm 0', async () => {
    const app = buildServer(createPrismaCustomerDataSource(prisma));

    const response = await app.inject({ method: 'GET', url: '/customers/by-distance' });
    const body = response.json() as Array<{ name: string; distanceKm: number | null }>;

    expect(response.statusCode).toBe(200);
    expect(body[0]).toMatchObject({ name: 'Anna Kovács', distanceKm: 0 });

    await app.close();
  });
});
```

- [ ] **Step 3: Ensure the database is migrated and seeded**

Run (skip any step already done in Task 6/7):
```bash
docker compose up -d
pnpm prisma:migrate:deploy
pnpm seed
pnpm seed
```
Expected: `pnpm seed` (run twice) both log `count: 15`.

- [ ] **Step 4: Run the full test suite**

Run:
```bash
pnpm typecheck
pnpm test
pnpm test:integration
```
Expected: `typecheck` clean; `pnpm test` — all unit tests from Tasks 2–8/10 pass, still offline; `pnpm test:integration` — both integration tests pass against the seeded local Postgres.

- [ ] **Step 5: Commit and push**

```bash
git add src/index.ts test/integration/customers-endpoints.integration.test.ts
git commit -m "feat: add service entry point and end-to-end integration tests"
git push
```

---

### Task 12: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: all scripts/commands established in Tasks 1–11.
- Produces: documentation only.

- [ ] **Step 1: Write `README.md`**

```markdown
# CustomerCounterSorter

Kicsi, önálló, offline futó REST szolgáltatás Postgres fölött: ügyfeleket
seedel, a településükhöz egy lokális, bundle-olt referenciából lat/lon-t
rendel, és két GET végponton szolgáltatja az adatot (darabszám, illetve
Budapesthez viszonyított távolság szerint rendezve).

## Előfeltételek

- Node.js LTS (20+)
- pnpm
- Docker Desktop (a lokális Postgres-hez)

## Futtatás

1. Függőségek telepítése:

   ```bash
   pnpm install
   ```

2. `.env` létrehozása a példából:

   ```bash
   cp .env.example .env
   ```

3. Postgres indítása:

   ```bash
   docker compose up -d
   ```

4. Migráció:

   ```bash
   pnpm prisma:migrate:deploy
   ```

5. Seed (idempotens — bátran futtatható többször is):

   ```bash
   pnpm seed
   ```

6. Szerver indítása:

   ```bash
   pnpm start
   ```

   Fejlesztéshez: `pnpm dev` (fájlváltozásra újraindul).

7. Végpontok kipróbálása:

   ```bash
   curl http://localhost:3000/customers/count
   curl http://localhost:3000/customers/by-distance
   ```

## Tesztek

- Unit tesztek (offline, nincs szükség futó Postgresre):

  ```bash
  pnpm test
  ```

- Integrációs tesztek (igényelnek egy migrált és seedelt Postgrest — az
  1–5. lépések után futtatandók):

  ```bash
  pnpm test:integration
  ```

- Típusellenőrzés:

  ```bash
  pnpm typecheck
  ```

## Végpontok

- `GET /customers/count` → `{ "count": <egész> }`
- `GET /customers/by-distance` → ügyféllista `distanceKm` mezővel,
  Budapesthez viszonyított távolság szerint növekvő sorrendben. Budapesti
  ügyfelek `0` km-rel elöl; ismeretlen koordinátájú ügyfelek a lista
  végén, `distanceKm: null`; holtverseny esetén név szerint rendezve.

## Geokódolás

A `docs/seed-customers.json`-ban szereplő településekhez tartozó lat/lon
egy a repóba bundle-olt, lokális referenciából
(`src/geocoding/city-reference.ts`) származik — nincs külső geokódoló
hívás futásidőben. Ismeretlen település esetén a seed script
figyelmeztetést logol, és `null` lat/lon-t ment (ez nem hiba).

## Adatmodell

```
customers (
  id            serial primary key,
  name          text unique,  -- idempotens seedhez szükséges kulcs
  telepules     text,
  lat           numeric(9,6),  -- nullable
  lon           numeric(9,6),  -- nullable
  budget        int,           -- nullable
  note          text           -- nullable
)
```
```

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: add README with setup, run, and test instructions"
git push
```
