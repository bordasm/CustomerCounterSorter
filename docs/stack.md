# CustomerCounterSorter — tech stack

Elv: iparági best practice, legfrissebb STABIL verzió (se cutting-edge, se elavult).

- Nyelv / monorepo: TypeScript (strict), pnpm, Node LTS
- DB: PostgreSQL lokálisan docker-compose-ban (Docker Desktop futtatja), Prisma (ORM: séma, migráció, seed, typed query). Helyben dolgozunk, nincs felhő-DB.
- CLI: commander + node:readline
- Eszköz: Visual Studio Code, gh CLI

## customers séma

```sql
, lat (nullable), lon (nullable). A budget és a note eltárolható, de nem kötelező.
customers (
  id            serial primary key,
  name          text,        -- ügyfél neve
  telepules     text,        -- település neve
  lat           numeric,     -- földrajzi szélesség, nem kötelező
  lon           numeric,     -- földrajzi hosszúság, nem kötelező
  budget        int,         -- büdzsé, nem kötelező
  note          text         -- jegyzet, nem kötelező
)
```
