# Customer distance service — design

Dátum: 2026-07-14
Állapot: jóváhagyva

## Cél

Kicsi, önálló, offline futó REST szolgáltatás Postgres fölött, amely a
`docs/seed-customers.json`-ban lévő 15 ügyfelet betölti, a településükhöz
egy lokálisan bundle-olt referenciából lat/lon-t rendel, és két GET
végponton keresztül szolgáltatja az adatot — az egyik Budapesthez
viszonyított távolság szerint rendezve.

Nem cél: authentikáció, write végpontok a seeden túl, frontend, külső
geokódoló API vagy LLM-hívás futásidőben.

## Architektúra

- **Nyelv/eszközök**: TypeScript (strict), Node LTS, pnpm. Nincs Nx —
  a feladat mérete nem indokolja a monorepo-overhead-et; a projekt egy
  önálló pnpm package a repo gyökerében.
- **HTTP keretrendszer**: Fastify. Indoklás: beépített pino structured
  logger (konvenciok.md tiltja a `console.log`-ot termékkódban), gyors,
  TS-barát, `.inject()` API-val DB nélkül tesztelhető route-logika.
- **ORM/migráció**: Prisma, `customers` tábla a stack.md sémája szerint,
  kiegészítve egy `name` UNIQUE constraint-tel (indoklás lentebb).
- **DB**: PostgreSQL, docker-compose-ban, kizárólag lokális dev, nincs
  felhő-DB.
- **Teszt**: Vitest (a dev-workflow.md hook-ja is ezt hivatkozza).

## Adatmodell

```prisma
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

**Döntés — `name` UNIQUE**: a stack.md "minimum" sémája nem ír elő unique
constraint-et, de az idempotens seedhez (kétszeri lefuttatás ne
duplázzon) szükséges egy természetes kulcs. A seed-customers.json 15
ügyfelének neve egyedi, ezért a `name` mezőt választjuk upsert-kulcsnak.
Ez a séma tudatos kiegészítése a "minimum" felett, nem ütközik semmivel.

## Komponensek

Minden geokódolási/távolság-komponens **tiszta függvény** (nincs I/O),
így izoláltan, offline unit-tesztelhető:

1. `src/geocoding/normalize-city.ts`
   `normalizeCityName(raw: string): string` — lowercase, ékezet-eltávolítás
   (Unicode NFD + diakritikus jelek törlése), trim, whitespace-collapse.
   Felismeri a "Budapest, XI. kerület" / "Budapest XI." / "Bp. XI. ker."
   típusú alakokat is, és `"budapest"`-re normalizálja őket.

2. `src/geocoding/city-reference.ts`
   Statikus `Record<string, { lat: number; lon: number }>` a 15 seed
   városra (Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków,
   Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin,
   Copenhagen), normalizált kulcsokkal. Publikusan ismert, stabil
   koordináták (fővárosok/nagyvárosok centruma), a repóba bundle-olva.

3. `src/geocoding/geocode-city.ts`
   `geocodeCity(rawTownName: string): { lat: number; lon: number } | null`
   — normalizál, referenciában keres, nem találat esetén `null` (nem hiba).

4. `src/distance/haversine.ts`
   `haversineKm(a: {lat:number;lon:number}, b: {lat:number;lon:number}): number`
   — nagy kör távolság km-ben. **Ez a kötelező unit-tesztelt egység.**

5. `src/distance/distance-from-budapest.ts`
   `distanceFromBudapestKm(lat: number | null, lon: number | null): number | null`
   — ha `lat`/`lon` bármelyike `null`/`undefined`: `null`. Egyébként
   `haversineKm` a `BUDAPEST` konstans koordinátához, 1 tizedesre kerekítve.

6. `src/logger.ts` — megosztott pino logger példány (server és seed
   script közösen használja; ez a "strukturált logger" a konvenciók
   szerint, nincs `console.log`).

7. `src/seed/seed-customers.ts`
   Idempotens seed script:
   - beolvassa a **meglévő** `docs/seed-customers.json`-t (nincs
     duplikáció máshova),
   - minden sorhoz `geocodeCity(location.city)`,
   - `prisma.customer.upsert({ where: { name }, update: {...}, create: {...} })`,
   - ismeretlen település esetén `logger.warn(...)`, lat/lon = null,
     **nem dob hibát és nem áll le**,
   - kétszer lefuttatva a sorok száma és tartalma azonos marad.

8. `src/routes/customers.ts`
   - `GET /customers/count` → `{ count: number }` (`prisma.customer.count()`).
   - `GET /customers/by-distance` → az összes ügyfél, minden elemen
     `distanceKm` mezővel. Rendezés: `distanceKm` növekvő, `null` a lista
     végén, holtverseny esetén `name` szerint (`localeCompare`).
     A rendezés app-oldalon történik (15 sor, nem indokolt DB-oldali
     számítás).

9. `src/server.ts` — Fastify app factory, Prisma client dependency
   injection-nel (tesztekben mock/valós DB is adható).

10. `src/index.ts` — belépési pont, `PORT` env-ből, szerver indítás.

11. `docker-compose.yml` — Postgres 16, `.env`-ből olvasott
    felhasználó/jelszó/db név, named volume.

12. `.env.example` — `DATABASE_URL`, `PORT`.

## Adatfolyam

```
docker-compose up -d
  → pnpm prisma migrate deploy   (customers tábla létrehozása)
  → pnpm seed                    (docs/seed-customers.json beolvasása,
                                   geokódolás, idempotens upsert)
  → pnpm dev / pnpm start        (Fastify szerver indítása)
  → GET /customers/count
  → GET /customers/by-distance
```

## Hibakezelés

- Seed: ismeretlen település → log + `null` koordináta, folytatás.
  Valódi hiba (DB kapcsolat, JSON parse) → fail-fast, nem-nulla exit
  kóddal, hibás log.
- Route handlerek: nincs request body/query paraméter, így nincs
  validációs felület; váratlan hiba esetén Fastify default 500 + pino
  error log.
- `unknown` típusú hibák `instanceof Error` szűküléssel logolva.

## Tesztelés

- **Unit (offline, `pnpm test`)**:
  - `haversine.test.ts`: Budapest–Bécs ≈ 214 km (toleranciával), Budapest
    önmagával = 0 km.
  - `distance-from-budapest.test.ts`: null lat vagy lon → `null`,
    kerekítés 1 tizedesre.
  - `normalize-city.test.ts`: ékezet/kis-nagybetű/whitespace robusztusság,
    Budapest kerület aliasok.
  - `geocode-city.test.ts`: ismert város → koordináta, ismeretlen város
    → `null`, kerület-alias → Budapest koordináta.
- **Integration (opcionális, `pnpm test:integration`, igényel futó
  Postgrest)**: a 2 végpont válasza seedelt adaton, seed idempotencia
  (kétszeri futtatás → azonos sorszám).
- A kötelező "offline futás" elvárást az unit tesztek (nincs I/O) és maga
  a szolgáltatás (nincs külső hívás runtime-ban) biztosítja.

## Git / repo

- A repo jelenleg nincs git alá véve. `git init`, majd a `harness/superpowers`
  branch létrehozása és checkoutolása — minden commit (a meglévő
  `docs/`, `.gitignore` tartalom első commitja is) ezen a branchen történik.
- Kis, fókuszált commitok (Conventional Commits: `feat`, `test`, `docs`,
  `chore`), minden commit után `git push`.
- Publikus GitHub repo létrehozása `gh repo create --public`-kal, ez lesz
  az `origin`.
- `.gitignore` kiegészítése szükség szerint (pl. `node_modules/`,
  build-output, `.env`).

## README

Futtatási lépések: Postgres indítás (docker-compose), migráció, seed,
szerver indítás, unit tesztek, (opcionális) integrációs tesztek —
másolható parancsokkal.

## Postgres MCP

A system-prompt.md kéri a Postgres MCP bekötését fejlesztés közbeni
séma/adat-betekintéshez. Ez fejlesztői segédeszköz, nem a szolgáltatás
funkcionális része — ha elérhető MCP szerver van a munkamenetben, azt
használom a fejlesztés során; ha nincs, ez nem blokkolja a leszállítást.
