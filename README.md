# Customer Distance Service

Ez a repo az ** AI-ágensfejlesztés az alapoktól ** kurzus egyik elkészítendő feladatát tartalmazza.

Kicsi, önálló REST szolgáltatás Postgres fölött. Betöltéskor minden ügyfélhez
a településéből lat/lon készül egy lokálisan bundle-olt referenciából —
nincs külső geokódoló hívás, nincs LLM-hívás, a szolgáltatás teljesen
offline fut.

## Előfeltételek

- Node.js >= 20.6
- pnpm >= 11 (a `pnpm-workspace.yaml` `allowBuilds` kulcsa pnpm v11+ szükséges)
- Docker Desktop (a lokális Postgres-hez)

## Futtatás

1. Függőségek telepítése:

   ```bash
   pnpm install
   ```

2. `.env` létrehozása a mintából (ha még nincs):

   ```bash
   cp .env.example .env
   ```

3. Postgres indítása:

   ```bash
   pnpm db:up
   ```

4. Migráció alkalmazása:

   ```bash
   pnpm exec prisma migrate deploy
   ```

5. Seed betöltése (idempotens — többször is futtatható, nem duplikál):

   ```bash
   pnpm db:seed
   ```

6. Szerver indítása:

   ```bash
   pnpm dev
   ```

7. Tesztek futtatása:

   ```bash
   pnpm test
   ```

## Végpontok

- `GET /customers/count` → `{ "count": <int> }`
- `GET /customers/by-distance` → ügyféllista Budapesthez viszonyított
  növekvő távolság szerint, `distanceKm` mezővel (1 tizedesre kerekítve,
  vagy `null` ismeretlen település esetén).

## Offline garancia

A településhez tartozó koordinátákat a `src/geocoding/city-coordinates.ts`
statikus, repóba bundle-olt referenciája adja. Nincs futásidejű hálózati
hívás sem a szerverben, sem a seed scriptben.
