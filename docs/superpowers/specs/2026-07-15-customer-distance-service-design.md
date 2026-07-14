# Customer Distance Service — Design Spec

Dátum: 2026-07-15

## Cél

Kicsi, önálló REST szolgáltatás Postgres fölött, seedelt ügyféladattal és két GET
végponttal. Betöltéskor minden ügyfélhez a településéből lat/lon készül egy
lokális, bundle-olt referenciából (nincs külső geokódoló hívás), és az egyik
végpont Budapesthez viszonyított távolság szerint rendezi az ügyfeleket.
Teljesen offline kell futnia.

Nem cél: authentikáció, write végpontok a seeden túl, frontend, külső
geokódoló API vagy LLM használat.

## Architektúra és mappastruktúra

A szolgáltatás a repó gyökerében él (nem monorepo-almappában, mivel egyetlen
szolgáltatásról van szó):

```
/
├── docker-compose.yml          # Postgres 16, lokális volume
├── .env.example                # DATABASE_URL minta
├── prisma/
│   ├── schema.prisma           # Customer modell
│   └── seed.ts                 # idempotens seed + enrichment hívás
├── src/
│   ├── server.ts               # Fastify bootstrap
│   ├── routes/
│   │   └── customers.ts        # 2 GET endpoint (vékony route réteg)
│   ├── geo/
│   │   ├── haversine.ts        # tiszta távolság-számító függvény
│   │   ├── haversine.test.ts
│   │   ├── sort-by-distance.ts # rendezési logika (tiszta, tesztelt)
│   │   └── sort-by-distance.test.ts
│   ├── geocoding/
│   │   ├── city-coordinates.ts # bundle-olt telepules -> lat/lon referencia
│   │   ├── resolve-city.ts     # normalizálás + lookup
│   │   └── resolve-city.test.ts
│   └── db/
│       └── prisma-client.ts    # Prisma client singleton
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

Választott eszközök: TypeScript (strict), pnpm, Fastify (HTTP), Prisma (ORM,
séma, migráció, seed), vitest (teszt) — a stack.md-ben rögzített
konvenciókkal összhangban.

## Adatmodell és migráció

```prisma
model Customer {
  id        Int      @id @default(autoincrement())
  name      String   @unique   // idempotens seed kulcs
  telepules String
  lat       Decimal? @db.Decimal(9, 6)
  lon       Decimal? @db.Decimal(9, 6)
  budget    Int?
  note      String?

  @@map("customers")
}
```

- `name` egyedi mező: a seed adatban nincs más stabil természetes kulcs
  (nincs email vagy külső azonosító), ez teszi lehetővé az upsert-alapú
  idempotens seedelést.
- `lat`/`lon` nullable `Decimal(9,6)`: elég pontosság koordinátákhoz, null ha
  a település nem ismert a referenciában.
- `budget`, `note`: opcionális mezők, eltárolva de nem kötelezőek.
- Migráció Prisma-val generálva (`prisma migrate dev`), a `prisma/migrations/`
  alá kerül, verziózott és determinisztikusan újrafuttatható.

## Betöltés (idempotens seed + enrichment)

1. `prisma/seed.ts` beolvassa a `docs/seed-customers.json` fájlt (egyetlen
   forrás, nincs duplikálva máshova).
2. Minden rekordra meghívja a `resolveCity(location.city)` tiszta függvényt,
   ami `{ lat: number, lon: number } | null`-t ad vissza.
3. `prisma.customer.upsert({ where: { name }, update, create })` — kétszeri
   futtatás nem duplikál; ha a `city-coordinates.ts` referencia bővül, a
   következő seed-futás frissíti a korábban `null` koordinátájú rekordokat is.
4. Ismeretlen település esetén `lat/lon = null`, figyelmeztető log, a folyamat
   nem áll le (nem hiba, csak hiányos adat).

### Geokódolási referencia

`src/geocoding/city-coordinates.ts`: statikus, kézzel felvett lat/lon a
seedben szereplő 15 városra (Budapest, Vienna, Munich, Milan, Barcelona,
Lyon, Kraków, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest,
Dublin, Copenhagen). Nincs futásidejű hálózati hívás.

`src/geocoding/resolve-city.ts`: a bemenetet normalizálja (trim, lowercase,
ékezetek eltávolítása Unicode NFD dekompozícióval) mielőtt a referencia-Map-ben
keres. A "Budapest" előtagú bemenetek (pl. kerület-jelöléssel) a fővárosra
esnek. Ismeretlen település esetén `null`-t ad vissza — ez nem hiba.

## Végpontok

### `GET /customers/count`

Válasz: `{ "count": <int> }`, a `customers` tábla tényleges sorszámával
egyezik (`prisma.customer.count()`).

### `GET /customers/by-distance`

Ügyféllista, Budapesthez (fix referenciapont: `lat 47.4979, lon 19.0402`)
viszonyított távolság szerint növekvő sorrendben. Minden elem tartalmaz egy
`distanceKm` mezőt (1 tizedesre kerekítve, vagy `null` ismeretlen
koordinátájú ügyfélnél).

Rendezési szabály:
- Ismert koordinátájú ügyfelek `distanceKm` szerint növekvő sorrendben
  (Budapesti ügyfelek `0.0` km-rel elöl).
- Ismeretlen koordinátájú ügyfelek (`distanceKm: null`) a lista végén.
- Holtverseny esetén (egyenlő távolság, vagy mindkettő `null`) `name` szerint
  ábécésorrendben.

A számítás és rendezés egy tiszta `sortByDistanceFromBudapest(customers)`
függvényben történik (`src/geo/sort-by-distance.ts`), amit a route réteg csak
meghív — a route logikamentes, a domain-logika unit tesztelhető marad az
adatbázistól függetlenül.

## Tesztelés

- `haversine.test.ts`: Budapest–Bécs ≈ 214 km (±2 km tolerancia), Budapest–
  Budapest = 0 km, hiányzó koordináta esetén a függvény `null`-t ad vissza.
- `sort-by-distance.test.ts`: helyes sorrend vegyes (ismert + ismeretlen
  koordinátájú) bemeneten, holtverseny name szerinti feloldása.
- `resolve-city.test.ts`: ékezet/kisbetű/whitespace-független egyezés,
  ismeretlen település `null` eredménye.
- Mindegyik pure function teszt, adatbázis nélkül fut — offline, gyors,
  determinisztikus.

## Eszközök, offline garancia, README

- `docker-compose.yml`: egyetlen `postgres:16` szolgáltatás lokális volume-mal,
  jelszó `.env`-ből (gitignore-olva), `.env.example` a repóban mintaként.
- `package.json` scriptek: `dev`, `build`, `db:up`, `db:migrate`, `db:seed`,
  `test`.
- README lépései: Postgres indítás (`docker compose up -d`) → migráció
  (`prisma migrate deploy`) → seed (`pnpm db:seed`) → szerver indítás
  (`pnpm dev`) → tesztek (`pnpm test`). Explicit megjegyzés, hogy a
  szolgáltatás teljesen offline fut: nincs külső geokódoló hívás, nincs
  LLM-hívás, a településreferencia statikusan bundle-olva van.
- Fejlesztés közben, ha elérhető, Postgres MCP-vel ellenőrizzük a sémát/adatot
  — ez fejlesztői segédeszköz, nem a szolgáltatás futásidejű része.

## Git munkafolyamat

Kis, fókuszált commitok lépésenként (Conventional Commits), mindegyik után
push a `harness/superpowers` branch-re, a dev-workflow.md konvenciói szerint.
