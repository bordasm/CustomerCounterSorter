# Kódkonvenciók és best practice-ek

> **Projekt-független** coding conventions, bármely TypeScript projektre. Ezt is 1:1 átadjuk a Claude Code-nak.

## Naming

- `camelCase` változó/függvény, `PascalCase` típus/osztály/komponens, `UPPER_SNAKE` konstans.
- Beszédes nevek; boolean: `is`/`has`/`can` prefix; függvény = ige (`fetchUser`, `parseQuery`).
- Fájlnév: `kebab-case`. Egy fájl egy felelősség.

## TypeScript

- `strict` mód. Explicit típus a publikus API-n; lokálisan elég az inferencia.
- `unknown` a külső/megbízhatatlan inputra, NEM `any`; szűkíts biztonságosan.
- `interface` objektum-alakra (ami bővülhet), `type` unió/intersection/utility-re. String literal union `enum` helyett.
- Immutabilitás, ne mutálj:
  ```ts
  // rossz: obj.x = 1
  // jó:    const next = { ...obj, x: 1 }
  ```

## Hibakezelés

- async `try/catch`; az `unknown` errort szűkítsd (`instanceof Error`).
- Ne nyeld el a hibát némán; UI-facing üzenet + szerver-oldali részletes log.
- Validáció a rendszer-határokon (Zod), fail-fast, beszédes hibaüzenet.
  ```ts
  const Input = z.object({ text: z.string().min(1) })
  ```

## Tesztelés

- TDD ahol értelmes: piros (bukó teszt) → zöld (minimál implementáció) → refaktor.
- Szintek: unit (függvények), integration (DB/API), E2E kritikus flow-ra (Playwright).
- Egy teszt egy dolgot ellenőrizzen; beszédes nevek ("should ... when ...").
- Determinista, izolált tesztek; ne függj külső/globális állapottól vagy időzítéstől.
- Cél: 80%+ lefedettség.

## Fájlszervezés

- Sok kis, fókuszált fájl (200-400 sor, max 800). Magas kohézió, alacsony csatolás.
- Feature/domain szerint rendezz, ne típus szerint.
- Nincs mély beágyazás (>4 szint); korai return.

## Naplózás

- Nincs `console.log` a termékkódban → strukturált logger.

## Biztonság

- Titkok env-ben (`.env`), soha a repóba (gitignore).
- Minden külső adat (user input, API-válasz, LLM-output) megbízhatatlan: validáld, ne bízz benne.
- Paraméterezett lekérdezések; ne építs query-t string-konkatenációval.

## Git

- Conventional Commits, feature branch, kicsi fókuszált commitok. Részletek: `dev-workflow.md`.
