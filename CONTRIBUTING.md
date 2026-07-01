# Contributing

Thanks for your interest! Every contribution is welcome — a bug fix, a new feature, or just flagging a problem.

## Reporting a bug

Open a [GitHub Issue](../../issues/new) and describe:
- What you were doing
- What happened
- What you expected
- Browser / OS version

## Proposing a feature

Open an Issue describing your idea. For anything large, it's best to discuss the intent first — it saves both sides time.

## Pull requests

1. Fork the repository and create a branch off `main`:
   ```bash
   git checkout -b feat/feature-name
   ```

2. Write your code. Follow the existing style (TypeScript, Tailwind, Convex patterns).

3. Run the tests — all must pass:
   ```bash
   npm run test:run
   ```

4. Add tests under `__tests__/` for any non-trivial logic.

5. Open a PR describing what you changed and why.

## What's welcome

- Bug fixes
- New accessory exercises for the catalog (`lib/accessory-catalog.ts`)
- Translations and i18n improvements (the app ships with Czech and English — locale files live in `public/locales/`)
- Mobile UX improvements
- Documentation and code comments

## What doesn't belong here

- Changes to the 5/3/1 math without a reference to Wendler's book — the implementation deliberately follows the *Forever* book
- Extra dependencies without a clear reason
- AI-generated PRs without an understanding of the code

## Local setup

See [README.en.md](README.en.md) — the *Fork & Local Setup* section.

---

Questions? Open an Issue or reach out at josef.krajkar@mensa.cz.
