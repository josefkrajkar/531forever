> 🇨🇿 Česká verze: [README.md](README.md)

# Power Diary — 5/3/1 Forever Powerlifting App

A personal training journal for powerlifting built on Jim Wendler's **5/3/1 Forever** system. Deterministic weight calculations, offline-first architecture, and automatic Training Max progression.

**Live demo:** _(TBD)_

---

## Features

### 5/3/1 Forever system
- **Leader / Anchor cycles** — 2× Leader (6 weeks) + Anchor (3 weeks) = one macrocycle
- **7th Week Protocol** — TM Test or Deload between phases
- **Templates:** BBB, FSL, SSL, BBS
- **3-week cycles** (5+, 3+, 1+ week)
- Automatic TM progression on the server after each completed cycle

### Training
- AMRAP logging with autoregulation (RPE)
- Plate visualizer
- Rest timer with alarm
- Wake lock (screen stays on during training)

### Statistics & tracking
- Training Max progression chart
- Estimated 1RM (Epley formula)
- Cycle history with notes
- Bodyweight log and chart
- Readiness tracking (fatigue, sleep, motivation)

### Internationalisation
- UI available in **Czech and English**
- Cookie-based language switcher (default: Czech)
- Locale files: `public/locales/{cs,en}/common.json`

### Technical
- **Offline-first** — workouts work without internet, sync on reconnect
- Conflict resolution on sync
- PWA manifest

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| Backend | [Convex](https://convex.dev) |
| Styling | Tailwind CSS |
| Auth | Convex Auth (OTP e-mail) |
| Tests | Vitest + React Testing Library |

---

## Fork & Local Setup

### 1. Prerequisites

- Node.js ≥ 20.9
- A [Convex](https://dashboard.convex.dev) account (free tier is enough)
- An OTP e-mail provider (see below)

### 2. Clone and install

```bash
git clone https://github.com/<your-username>/power-diary.git
cd power-diary
npm install
```

### 3. Create a Convex project

```bash
npx convex dev
```

On first run, Convex walks you through sign-in and creates a new project. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local` automatically.

### 4. Environment variables

Copy the template:

```bash
cp .env.example .env.local
```

Fill in the values (see the comments in `.env.example`).

### 5. Convex env vars for auth

In the Convex dashboard (Settings → Environment Variables) set:

```
CONVEX_SITE_URL=http://localhost:3000
OTP_ENDPOINT=<url of your OTP provider>
CHAT_ID=<channel/chat id for OTP messages>
APP_NAME=Power Diary
SECRET_KEY=<random secret key>
```

> **OTP provider:** The app uses a custom HTTP endpoint to send OTP codes by e-mail. Any service works (Resend, SendGrid, your own) — just implement an endpoint that accepts `{ to, code, appName }` and sends an e-mail.

### 6. Run

```bash
npm run dev
```

App runs at http://localhost:3000.

---

## Testing

```bash
npm run test:run
```

679 tests cover Convex functions (programs, bodyweight, accessories, readiness), utility libraries (5/3/1 calculator, offline store, sync engine), and React hooks.

---

## Project Structure

```
/app                    Next.js pages (App Router)
/components             React components
  /program-workout/     Sub-components + hooks for the workout screen
/convex                 Convex backend
  schema.ts             Database schema
  programs.ts           Core program logic (calibration, workout, TM progression)
  bodyweight.ts         Bodyweight tracking
  readiness.ts          Readiness tracking
  accessories.ts        Accessory exercises
/lib
  531.ts                5/3/1 calculator, TM progression
  templates.ts          Template definitions (BBB, FSL, SSL, BBS)
  profile.ts            Canonical gender/experience types, normalisation & i18n-key helpers
  offline-store.ts      Offline cache (IndexedDB)
  sync-engine.ts        Sync orchestrator
  outbox.ts             Mutation outbox for offline
  i18n.ts               Client-side i18n setup
  i18n-server.ts        Server-side i18n setup
  i18n-config.ts        Shared language config (supported langs, default)
/hooks                  Shared React hooks
/public/locales         Translation files
  /cs/common.json       Czech strings
  /en/common.json       English strings
/__tests__              Tests (Vitest)
```

---

## Contributing

Bug reports, feature ideas, and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) (currently Czech-only) for guidelines.

---

## License

MIT — use it, fork it, improve it. If it helped your training, feel free to say hi. 💪
