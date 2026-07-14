# Customer Distance Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small, standalone REST service over Postgres that seeds customer data, enriches each customer's town with lat/lon from a bundled local reference, and exposes two GET endpoints (count, and distance-from-Budapest sorted list).

**Architecture:** TypeScript/Node service in the repo root. Pure, unit-tested domain modules (`src/geo`, `src/geocoding`) hold all distance/geocoding logic; Prisma owns the schema/migration/seed; a thin Fastify layer (`src/routes`) wires HTTP to the domain modules and Prisma. No external network calls anywhere.

**Tech Stack:** TypeScript (strict, ESM/NodeNext), pnpm, Node >=20.6 (for `--env-file`), Fastify, Prisma + PostgreSQL (via Docker Compose), vitest, tsx.

## Global Constraints

- Teljesen offline kell futnia: nincs külső geokódoló API hívás, nincs LLM-hívás futásidőben.
- Nincs authentikáció.
- Nincs write végpont a seeden túl (csak a két GET végpont).
- Nincs frontend.
- TypeScript `strict` mód mindenhol.
- Conventional Commits, kis fókuszált commitok; minden commit után `git push` a `harness/superpowers` branch-re.
- `GET /customers/by-distance` válaszban `distanceKm` 1 tizedesre kerekítve; Budapest 0 km-rel elöl; ismeretlen koordináta `distanceKm: null` a lista végén; holtverseny esetén `name` szerint.
- Település-egyeztetés ékezet-, kis/nagybetű- és whitespace-független; ismeretlen település nem hiba (lat/lon = null, logolva).

---

### Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `pnpm` scripts (`dev`, `build`, `start`, `db:up`, `db:down`, `db:migrate`, `db:seed`, `test`) that every later task relies on to run its own work.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "customer-distance-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.6"
  },
  "scripts": {
    "dev": "tsx --env-file=.env src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node --env-file=.env dist/server.js",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "tsx --env-file=.env prisma/seed.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "fastify": "^5.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "prisma": "^5.20.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: lockfile `pnpm-lock.yaml` created, install finishes without errors.

- [ ] **Step 5: Verify the test runner works with no tests yet**

Run: `pnpm test`
Expected: vitest exits 0 (`passWithNoTests: true` avoids a hard failure with zero test files).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts
git commit -m "chore: scaffold TypeScript project with pnpm, vitest, tsx"
git push
```

---

### Task 2: Shared coordinate type + haversine distance (TDD)

**Files:**
- Create: `src/geo/coordinates.ts`
- Create: `src/geo/haversine.ts`
- Test: `src/geo/haversine.test.ts`

**Interfaces:**
- Consumes: nothing beyond Task 1's tooling.
- Produces: `interface Coordinates { lat: number; lon: number }` (`src/geo/coordinates.ts`), `function haversineDistanceKm(a: Coordinates | null, b: Coordinates | null): number | null` (`src/geo/haversine.ts`) — both later consumed by `src/geocoding/city-coordinates.ts`, `src/geocoding/resolve-city.ts`, and `src/geo/sort-by-distance.ts`.

- [ ] **Step 1: Create the shared `Coordinates` type**

```ts
// src/geo/coordinates.ts
export interface Coordinates {
  lat: number;
  lon: number;
}
```

- [ ] **Step 2: Write the failing test for `haversineDistanceKm`**

```ts
// src/geo/haversine.test.ts
import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./haversine.js";

const BUDAPEST = { lat: 47.4979, lon: 19.0402 };
const VIENNA = { lat: 48.2082, lon: 16.3738 };

describe("haversineDistanceKm", () => {
  it("returns the known distance between Budapest and Vienna", () => {
    const distance = haversineDistanceKm(BUDAPEST, VIENNA);
    expect(distance).not.toBeNull();
    expect(distance!).toBeGreaterThan(210);
    expect(distance!).toBeLessThan(220);
  });

  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceKm(BUDAPEST, BUDAPEST)).toBe(0);
  });

  it("returns null when either coordinate is missing", () => {
    expect(haversineDistanceKm(BUDAPEST, null)).toBeNull();
    expect(haversineDistanceKm(null, VIENNA)).toBeNull();
    expect(haversineDistanceKm(null, null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/geo/haversine.test.ts`
Expected: FAIL — `./haversine.js` (or `haversineDistanceKm`) not found, since `haversine.ts` doesn't exist yet.

- [ ] **Step 4: Implement `haversineDistanceKm`**

```ts
// src/geo/haversine.ts
import type { Coordinates } from "./coordinates.js";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(
  a: Coordinates | null,
  b: Coordinates | null,
): number | null {
  if (a === null || b === null) {
    return null;
  }

  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/geo/haversine.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/geo/coordinates.ts src/geo/haversine.ts src/geo/haversine.test.ts
git commit -m "feat: add haversine distance calculation"
git push
```

---

### Task 3: Geocoding reference + city resolution (TDD)

**Files:**
- Create: `src/geocoding/city-coordinates.ts`
- Create: `src/geocoding/resolve-city.ts`
- Test: `src/geocoding/resolve-city.test.ts`

**Interfaces:**
- Consumes: `Coordinates` from `src/geo/coordinates.ts` (Task 2).
- Produces: `function resolveCity(city: string): Coordinates | null` (`src/geocoding/resolve-city.ts`) — consumed by `prisma/seed.ts` (Task 6).

- [ ] **Step 1: Create the bundled city reference**

```ts
// src/geocoding/city-coordinates.ts
import type { Coordinates } from "../geo/coordinates.js";

export const CITY_COORDINATES: ReadonlyMap<string, Coordinates> = new Map([
  ["budapest", { lat: 47.4979, lon: 19.0402 }],
  ["vienna", { lat: 48.2082, lon: 16.3738 }],
  ["munich", { lat: 48.1351, lon: 11.582 }],
  ["milan", { lat: 45.4642, lon: 9.19 }],
  ["barcelona", { lat: 41.3851, lon: 2.1734 }],
  ["lyon", { lat: 45.764, lon: 4.8357 }],
  ["krakow", { lat: 50.0647, lon: 19.945 }],
  ["prague", { lat: 50.0755, lon: 14.4378 }],
  ["lisbon", { lat: 38.7223, lon: -9.1393 }],
  ["amsterdam", { lat: 52.3676, lon: 4.9041 }],
  ["stockholm", { lat: 59.3293, lon: 18.0686 }],
  ["ljubljana", { lat: 46.0569, lon: 14.5058 }],
  ["bucharest", { lat: 44.4268, lon: 26.1025 }],
  ["dublin", { lat: 53.3498, lon: -6.2603 }],
  ["copenhagen", { lat: 55.6761, lon: 12.5683 }],
]);
```

- [ ] **Step 2: Write the failing test for `resolveCity`**

```ts
// src/geocoding/resolve-city.test.ts
import { describe, expect, it } from "vitest";
import { resolveCity } from "./resolve-city.js";

describe("resolveCity", () => {
  it("resolves an exact known city name", () => {
    expect(resolveCity("Vienna")).toEqual({ lat: 48.2082, lon: 16.3738 });
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveCity("  vIENNA  ")).toEqual({ lat: 48.2082, lon: 16.3738 });
  });

  it("is accent-insensitive", () => {
    expect(resolveCity("Krakow")).toEqual(resolveCity("Kraków"));
  });

  it("resolves Budapest district notations to the capital", () => {
    expect(resolveCity("Budapest XI. kerület")).toEqual({
      lat: 47.4979,
      lon: 19.0402,
    });
  });

  it("returns null for an unknown city", () => {
    expect(resolveCity("Atlantis")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/geocoding/resolve-city.test.ts`
Expected: FAIL — `resolveCity` not found, `resolve-city.ts` doesn't exist yet.

- [ ] **Step 4: Implement `resolveCity`**

```ts
// src/geocoding/resolve-city.ts
import type { Coordinates } from "../geo/coordinates.js";
import { CITY_COORDINATES } from "./city-coordinates.js";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeCityName(city: string): string {
  return city
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .trim()
    .toLowerCase();
}

export function resolveCity(city: string): Coordinates | null {
  const normalized = normalizeCityName(city);

  if (normalized.startsWith("budapest")) {
    return CITY_COORDINATES.get("budapest") ?? null;
  }

  return CITY_COORDINATES.get(normalized) ?? null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/geocoding/resolve-city.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/geocoding/city-coordinates.ts src/geocoding/resolve-city.ts src/geocoding/resolve-city.test.ts
git commit -m "feat: add offline city-to-coordinates resolution"
git push
```

---

### Task 4: Distance-based sorting (TDD)

**Files:**
- Create: `src/geo/sort-by-distance.ts`
- Test: `src/geo/sort-by-distance.test.ts`

**Interfaces:**
- Consumes: `haversineDistanceKm` from `src/geo/haversine.ts` (Task 2).
- Produces: `interface CustomerWithCoordinates { id: number; name: string; telepules: string; lat: number | null; lon: number | null; budget: number | null; note: string | null }`, `interface CustomerWithDistance extends CustomerWithCoordinates { distanceKm: number | null }`, `function sortByDistanceFromBudapest(customers: CustomerWithCoordinates[]): CustomerWithDistance[]` (`src/geo/sort-by-distance.ts`) — consumed by `src/routes/customers.ts` (Task 7).

- [ ] **Step 1: Write the failing test for `sortByDistanceFromBudapest`**

```ts
// src/geo/sort-by-distance.test.ts
import { describe, expect, it } from "vitest";
import { sortByDistanceFromBudapest } from "./sort-by-distance.js";
import type { CustomerWithCoordinates } from "./sort-by-distance.js";

const customers: CustomerWithCoordinates[] = [
  {
    id: 1,
    name: "Vienna Customer",
    telepules: "Vienna",
    lat: 48.2082,
    lon: 16.3738,
    budget: null,
    note: null,
  },
  {
    id: 2,
    name: "Budapest Customer",
    telepules: "Budapest",
    lat: 47.4979,
    lon: 19.0402,
    budget: null,
    note: null,
  },
  {
    id: 3,
    name: "Unknown City Zeta",
    telepules: "Atlantis",
    lat: null,
    lon: null,
    budget: null,
    note: null,
  },
  {
    id: 4,
    name: "Unknown City Alpha",
    telepules: "Atlantis",
    lat: null,
    lon: null,
    budget: null,
    note: null,
  },
];

describe("sortByDistanceFromBudapest", () => {
  it("orders customers ascending by distance, Budapest first, unknowns last", () => {
    const result = sortByDistanceFromBudapest(customers);
    expect(result.map((c) => c.name)).toEqual([
      "Budapest Customer",
      "Vienna Customer",
      "Unknown City Alpha",
      "Unknown City Zeta",
    ]);
  });

  it("assigns 0 km distance to Budapest and rounds to 1 decimal", () => {
    const result = sortByDistanceFromBudapest(customers);
    const budapestCustomer = result.find((c) => c.name === "Budapest Customer")!;
    expect(budapestCustomer.distanceKm).toBe(0);
    const viennaCustomer = result.find((c) => c.name === "Vienna Customer")!;
    expect(viennaCustomer.distanceKm!).toBeGreaterThan(210);
    expect(viennaCustomer.distanceKm!).toBeLessThan(220);
  });

  it("breaks ties among unknown-distance customers by name", () => {
    const result = sortByDistanceFromBudapest(customers);
    const unknowns = result
      .filter((c) => c.distanceKm === null)
      .map((c) => c.name);
    expect(unknowns).toEqual(["Unknown City Alpha", "Unknown City Zeta"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/geo/sort-by-distance.test.ts`
Expected: FAIL — `sort-by-distance.ts` doesn't exist yet.

- [ ] **Step 3: Implement `sortByDistanceFromBudapest`**

```ts
// src/geo/sort-by-distance.ts
import type { Coordinates } from "./coordinates.js";
import { haversineDistanceKm } from "./haversine.js";

export interface CustomerWithCoordinates {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface CustomerWithDistance extends CustomerWithCoordinates {
  distanceKm: number | null;
}

const BUDAPEST: Coordinates = { lat: 47.4979, lon: 19.0402 };

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sortByDistanceFromBudapest(
  customers: CustomerWithCoordinates[],
): CustomerWithDistance[] {
  const withDistance: CustomerWithDistance[] = customers.map((customer) => {
    const coordinates: Coordinates | null =
      customer.lat !== null && customer.lon !== null
        ? { lat: customer.lat, lon: customer.lon }
        : null;
    const distanceKm = haversineDistanceKm(BUDAPEST, coordinates);

    return {
      ...customer,
      distanceKm: distanceKm === null ? null : roundToOneDecimal(distanceKm),
    };
  });

  return withDistance.sort((a, b) => {
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/geo/sort-by-distance.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Run the full test suite so far**

Run: `pnpm test`
Expected: PASS — all test files (haversine, resolve-city, sort-by-distance) green.

- [ ] **Step 6: Commit**

```bash
git add src/geo/sort-by-distance.ts src/geo/sort-by-distance.test.ts
git commit -m "feat: add distance-from-Budapest sorting"
git push
```

---

### Task 5: Docker Compose + Prisma schema & migration

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/` (generated by Prisma CLI)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a running local Postgres with a `customers` table matching the `Customer` Prisma model — consumed by `src/db/prisma-client.ts` and `prisma/seed.ts` (Task 6).

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: customer_distance
      POSTGRES_PASSWORD: customer_distance
      POSTGRES_DB: customer_distance
    ports:
      - "5432:5432"
    volumes:
      - customer_distance_pgdata:/var/lib/postgresql/data

volumes:
  customer_distance_pgdata:
```

- [ ] **Step 2: Create `.env.example`**

```
DATABASE_URL="postgresql://customer_distance:customer_distance@localhost:5432/customer_distance?schema=public"
PORT=3000
```

- [ ] **Step 3: Create a local `.env` from the example**

Run: `cp .env.example .env`
Expected: `.env` created (already covered by the existing `.gitignore` entry, stays untracked).

- [ ] **Step 4: Create the Prisma schema**

```prisma
// prisma/schema.prisma
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

- [ ] **Step 5: Start Postgres**

Run: `pnpm db:up`
Expected: `docker compose up -d` reports the `postgres` container started/healthy.

- [ ] **Step 6: Generate and apply the initial migration**

Run: `pnpm exec prisma migrate dev --name init`
Expected: output ends with "Your database is now in sync with your schema." and a new folder `prisma/migrations/<timestamp>_init/migration.sql` is created containing the `CREATE TABLE "customers" (...)` statement.

- [ ] **Step 7: Verify migration status is clean**

Run: `pnpm exec prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml .env.example prisma/schema.prisma prisma/migrations
git commit -m "feat: add Postgres docker-compose and Customer migration"
git push
```

---

### Task 6: Idempotent seed script

**Files:**
- Create: `src/db/prisma-client.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `resolveCity` from `src/geocoding/resolve-city.ts` (Task 3); the `customers` table from Task 5; `docs/seed-customers.json` (existing repo file, 15 records: `{ name, budget, location: { city, countryCode }, note }`).
- Produces: `export const prisma: PrismaClient` (`src/db/prisma-client.ts`) — consumed by `src/routes/customers.ts` (Task 7). A populated, idempotently re-seedable `customers` table.

- [ ] **Step 1: Create the Prisma client singleton**

```ts
// src/db/prisma-client.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 2: Create the seed script**

```ts
// prisma/seed.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db/prisma-client.js";
import { resolveCity } from "../src/geocoding/resolve-city.js";

interface SeedCustomer {
  name: string;
  budget: number;
  location: {
    city: string;
    countryCode: string;
  };
  note: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFilePath = path.join(__dirname, "..", "docs", "seed-customers.json");

async function main(): Promise<void> {
  const raw = readFileSync(seedFilePath, "utf-8");
  const customers = JSON.parse(raw) as SeedCustomer[];

  for (const customer of customers) {
    const coordinates = resolveCity(customer.location.city);

    if (coordinates === null) {
      console.warn(
        `[seed] no coordinates found for city "${customer.location.city}" (customer: ${customer.name})`,
      );
    }

    await prisma.customer.upsert({
      where: { name: customer.name },
      update: {
        telepules: customer.location.city,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget,
        note: customer.note,
      },
      create: {
        name: customer.name,
        telepules: customer.location.city,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget,
        note: customer.note,
      },
    });
  }

  console.log(`[seed] upserted ${customers.length} customers`);
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Run the seed script for the first time**

Run: `pnpm db:seed`
Expected: no `[seed] no coordinates found` warnings (all 15 seed cities are in the reference), ends with `[seed] upserted 15 customers`.

- [ ] **Step 4: Verify row count after first run**

Run: `docker compose exec postgres psql -U customer_distance -d customer_distance -c "select count(*) from customers;"`
Expected: `count` = `15`.

- [ ] **Step 5: Run the seed script again to verify idempotency**

Run: `pnpm db:seed`
Expected: same `[seed] upserted 15 customers` output, no errors.

- [ ] **Step 6: Verify row count is still 15 (no duplicates)**

Run: `docker compose exec postgres psql -U customer_distance -d customer_distance -c "select count(*) from customers;"`
Expected: `count` = `15` (unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/db/prisma-client.ts prisma/seed.ts
git commit -m "feat: add idempotent customer seed with city enrichment"
git push
```

---

### Task 7: Fastify server + REST endpoints

**Files:**
- Create: `src/routes/customers.ts`
- Create: `src/server.ts`

**Interfaces:**
- Consumes: `prisma` from `src/db/prisma-client.ts` (Task 6); `sortByDistanceFromBudapest` and `CustomerWithCoordinates` from `src/geo/sort-by-distance.ts` (Task 4).
- Produces: a running HTTP server exposing `GET /customers/count` and `GET /customers/by-distance`.

- [ ] **Step 1: Create the customers route plugin**

```ts
// src/routes/customers.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma-client.js";
import { sortByDistanceFromBudapest } from "../geo/sort-by-distance.js";
import type { CustomerWithCoordinates } from "../geo/sort-by-distance.js";

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/customers/count", async () => {
    const count = await prisma.customer.count();
    return { count };
  });

  app.get("/customers/by-distance", async () => {
    const customers = await prisma.customer.findMany();

    const withCoordinates: CustomerWithCoordinates[] = customers.map(
      (customer) => ({
        id: customer.id,
        name: customer.name,
        telepules: customer.telepules,
        lat: customer.lat === null ? null : customer.lat.toNumber(),
        lon: customer.lon === null ? null : customer.lon.toNumber(),
        budget: customer.budget,
        note: customer.note,
      }),
    );

    return sortByDistanceFromBudapest(withCoordinates);
  });
}
```

- [ ] **Step 2: Create the server entrypoint**

```ts
// src/server.ts
import Fastify from "fastify";
import { customersRoutes } from "./routes/customers.js";

const app = Fastify({ logger: true });

await app.register(customersRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Start the server in the background**

Run: `pnpm dev &` (or start it in a background task runner)
Expected: log line `Server listening at http://0.0.0.0:3000`.

- [ ] **Step 4: Verify `GET /customers/count`**

Run: `curl -s http://localhost:3000/customers/count`
Expected: `{"count":15}`

- [ ] **Step 5: Verify `GET /customers/by-distance`**

Run: `curl -s http://localhost:3000/customers/by-distance`
Expected: a JSON array of 15 customers; the first entry has `"name":"Anna Kovács"` (the only Budapest customer) with `"distanceKm":0`; every entry has a `distanceKm` field; entries are non-decreasing by `distanceKm`.

- [ ] **Step 6: Stop the background server**

Run: `kill %1` (or stop the background task started in Step 3)
Expected: process terminates cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/routes/customers.ts src/server.ts
git commit -m "feat: add customers count and by-distance REST endpoints"
git push
```

---

### Task 8: README + end-to-end verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: every script and file from Tasks 1–7.
- Produces: documented, reproducible run instructions.

- [ ] **Step 1: Write the README**

```markdown
# Customer Distance Service

Kicsi, önálló REST szolgáltatás Postgres fölött. Betöltéskor minden ügyfélhez
a településéből lat/lon készül egy lokálisan bundle-olt referenciából —
nincs külső geokódoló hívás, nincs LLM-hívás, a szolgáltatás teljesen
offline fut.

## Előfeltételek

- Node.js >= 20.6
- pnpm
- Docker Desktop (a lokális Postgres-hez)

## Futtatás

1. Függőségek telepítése:

   \`\`\`bash
   pnpm install
   \`\`\`

2. `.env` létrehozása a mintából (ha még nincs):

   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Postgres indítása:

   \`\`\`bash
   pnpm db:up
   \`\`\`

4. Migráció alkalmazása:

   \`\`\`bash
   pnpm exec prisma migrate deploy
   \`\`\`

5. Seed betöltése (idempotens — többször is futtatható, nem duplikál):

   \`\`\`bash
   pnpm db:seed
   \`\`\`

6. Szerver indítása:

   \`\`\`bash
   pnpm dev
   \`\`\`

7. Tesztek futtatása:

   \`\`\`bash
   pnpm test
   \`\`\`

## Végpontok

- `GET /customers/count` → `{ "count": <int> }`
- `GET /customers/by-distance` → ügyféllista Budapesthez viszonyított
  növekvő távolság szerint, `distanceKm` mezővel (1 tizedesre kerekítve,
  vagy `null` ismeretlen település esetén).

## Offline garancia

A településhez tartozó koordinátákat a `src/geocoding/city-coordinates.ts`
statikus, repóba bundle-olt referenciája adja. Nincs futásidejű hálózati
hívás sem a szerverben, sem a seed scriptben.
```

- [ ] **Step 2: Run the full flow from a clean state to verify README accuracy**

Run:

```bash
pnpm db:down
pnpm db:up
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm test
```

Expected: migration applies cleanly, seed reports `[seed] upserted 15 customers`, all vitest test files pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and run instructions"
git push
```

---

## Self-Review Notes

- Spec coverage: adatmodell+migráció (Task 5), idempotens seed+geokódolás (Task 6), 2 GET végpont (Task 7), haversine unit teszt (Task 2), offline futás (Tasks 3, 6, 8 — no network calls anywhere), README (Task 8), kis fókuszált commitok + push (every task's final step).
- No placeholders: every step has complete, runnable code or an exact command with expected output.
- Type consistency verified: `Coordinates` (Task 2) is reused unchanged by `city-coordinates.ts` and `resolve-city.ts` (Task 3) and `sort-by-distance.ts` (Task 4); `CustomerWithCoordinates` (Task 4) is reused unchanged by `routes/customers.ts` (Task 7); `resolveCity` signature (Task 3) matches its usage in `prisma/seed.ts` (Task 6); `prisma` export (Task 6) matches its usage in `routes/customers.ts` (Task 7).
