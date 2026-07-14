# CustomerCounterSorter — fejlesztői workflow + automatizmus

> Konkrét git-szabályok, hook-konfigurációk, dokumentációs folyamat.

## Git

### Branching

- `main`: mindig zöld, deploy-olható. Közvetlenül main-re NEM commitolunk.
- Amikor más branch-et kell létrehoznod, az külön meg lesz nevezve.

### Commit (Conventional Commits)

Formátum: `<típus>: <leírás>`. Típusok: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`.
Példák: `feat: add read-only runSql tool`, `test: cover runSql SELECT-only guard`.

### Auto-commit

Minden befejezett, koherens lépés után kicsi, fókuszált commit (egy lépés = egy commit). Lásd a `Stop` hookot.

## Hookok (`settings.json`)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm prettier --write $FILE",
            "timeout": 10000,
            "async": true
          },
          {
            "type": "command",
            "command": "pnpm vitest related --run $FILE",
            "timeout": 60000,
            "async": true
          }
        ]
      }
    ]
  }
}
```

- **prettier** (PostToolUse, Edit): formázás szerkesztés után.
- **teszt** (PostToolUse, Edit): a változáshoz tartozó Vitest fut.

## /docs (a repóban)

```
docs/
├── dev-workflow.md
├── konvenciok.md
├── seed-customers.json
├── stack.md
└── system-prompt.md
```

## Dokumentáció-frissítés

A `/docs` frissítését szükség esetén végezd el, de előtte kérj engedélyt.
