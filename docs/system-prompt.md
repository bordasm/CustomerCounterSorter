Építs egy kicsi, önálló REST szolgáltatást Postgres fölött. Offline kell futnia: nincs külső geokódoló API, nincs LLM-hívás futásidőben.

ADAT
A seed adat a repóban lévő seed-customers.json fájlban van (15 ügyfél: name, budget, location.city, location.countryCode, note). A location.city a település.

ADATMODELL (minimum)
customers: id, name, telepules, lat (nullable), lon (nullable). A budget és a note eltárolható, de nem kötelező.

BETÖLTÉS (idempotens seed + geokódolás)
- Töltsd be a seed-customers.json-t. Kétszer lefuttatva ne duplázzon (idempotens legyen).
- Minden ügyfél településéhez rendelj lat/lon-t egy lokális, a repóba bundle-olt telepules -> lat/lon referenciából. A referenciát te állítod elő a seedben előforduló városokra, ismert koordinátákkal. NINCS külső hívás.
- A település-egyeztetés robusztus: ékezet- és kis/nagybetű-független, trimmelt whitespace. A "Budapest" (és opcionálisan a kerületei) a fővárosra esik.
- Ha egy település nincs a referenciában: lat/lon = null. Ez nem hiba, ne crasheljen. Logold, és menj tovább.

VÉGPONTOK
- GET /customers/count -> { "count": <egesz> } (a tényleges sorszámmal egyezik).
- GET /customers/by-distance -> ügyféllista NÖVEKVŐ távolság szerint Budapesthez képest. Minden elem tartalmazza a distanceKm mezőt (1 tizedesre kerekítve). Budapesti ügyfelek elöl (0 km). Ismeretlen koordinátájú ügyfelek a lista végén, distanceKm: null. Holtverseny esetén name szerint.

TESZT
- Unit teszt a távolságszámításra (haversine): egy ismert táv (pl. Budapest-Bécs kb. 214 km), a 0 km-es eset (Budapest), és a null-koordináta kezelése.

MINŐSÉG
- Kis, fókuszált commitok, hogy a folyamat is látszódjon.
- README a futtatáshoz: Postgres indítás, migráció, seed, szerver, tesztek.
- Kösd be a Postgres MCP-t, hogy fejlesztés közben lásd a sémát és az adatot.