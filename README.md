> 🇬🇧 English version: [README.en.md](README.en.md)

# 531Forever — 5/3/1 Forever Powerlifting App

Osobní tréninkový deník pro powerlifting postavený na systému **5/3/1 Forever** od Jima Wendlera. Deterministický výpočet vah, offline-first architektura, automatická TM progrese.

**Live demo:** https://www.531forever.app/

---

## Co appka umí

### 5/3/1 Forever systém
- **Leader / Anchor cykly** — 2× Leader (6 týdnů) + Anchor (3 týdny) = jeden macrocyklus
- **7th Week Protocol** — TM Test nebo Deload mezi fázemi
- **Šablony:** BBB, FSL, SSL, BBS
- **3týdenní cykly** (5+, 3+, 1+ týden)
- Automatická TM progrese serverem po každém dokončeném cyklu

### Trénink
- AMRAP logování s autoregulací (RPE)
- Zobrazení kotoučů na tyči
- Rest timer s budíkem
- Wake lock (obrazovka nespadne během tréninku)

### Statistiky & tracking
- Graf progrese Training Maxů
- Odhadované 1RM (Epley formula)
- Historie cyklů s poznámkami
- Tělesná váha (log + graf)
- Readiness tracking (únava, spánek, motivace)

### Technické
- **Offline-first** — trénink funguje i bez internetu, sync po připojení
- Konflikt-resolution při sync
- PWA manifest

---

## Tech Stack

| Vrstva | Technologie |
|--------|------------|
| Frontend | Next.js 16 (App Router) |
| Backend | [Convex](https://convex.dev) |
| Styling | Tailwind CSS |
| Auth | Convex Auth (OTP e-mail) |
| Testy | Vitest + React Testing Library |

---

## Fork & lokální setup

### 1. Prerekvizity

- Node.js 20.9+
- Účet na [Convex](https://dashboard.convex.dev) (free tier stačí)
- OTP e-mail provider (viz níže)

### 2. Klonování a instalace

```bash
git clone https://github.com/josefkrajkar/531forever.git
cd 531forever
npm install
```

### 3. Convex projekt

```bash
npx convex dev
```

Při prvním spuštění tě Convex provede přihlášením a vytvoří nový projekt. Uloží `CONVEX_DEPLOYMENT` a `NEXT_PUBLIC_CONVEX_URL` do `.env.local`.

### 4. Environment proměnné

Zkopíruj šablonu:

```bash
cp .env.example .env.local
```

Vyplň hodnoty (viz komentáře v `.env.example`).

### 5. Convex env vars pro auth

V Convex dashboardu (Settings → Environment Variables) nastav:

```
CONVEX_SITE_URL=http://localhost:3000
OTP_ENDPOINT=<url tvého OTP providera>
CHAT_ID=<id chatu/kanálu pro OTP zprávy>
APP_NAME=531Forever
SECRET_KEY=<náhodný tajný klíč>
```

> **OTP provider:** Appka používá vlastní HTTP endpoint pro odesílání OTP kódů e-mailem. Můžeš použít libovolnou službu (Resend, Sendgrid, vlastní) — stačí implementovat endpoint který přijme `{ to, code, appName }` a odešle e-mail.

### 6. Spuštění

```bash
npm run dev
```

Appka běží na http://localhost:3000.

---

## Testování

```bash
npm run test:run
```

684 testů pokrývá Convex funkce (programs, bodyweight, accessories, readiness), utility knihovny (5/3/1 kalkulátor, offline store, sync engine) a React hooky.

---

## Struktura projektu

```
/app                    Next.js pages (App Router)
/components             React komponenty
  /program-workout/     Sub-komponenty + hooky pro tréninkovou obrazovku
/convex                 Convex backend
  schema.ts             Databázové schéma
  programs.ts           Hlavní logika programu (kalibrace, workout, TM progrese)
  bodyweight.ts         Tělesná váha
  readiness.ts          Readiness tracking
  accessories.ts        Doplňkové cviky
/lib
  531.ts                5/3/1 kalkulátor, TM progrese
  templates.ts          Definice šablon (BBB, FSL, SSL, BBS)
  offline-store.ts      Offline cache (IndexedDB)
  sync-engine.ts        Sync orchestrátor
  outbox.ts             Mutation outbox pro offline
/hooks                  Sdílené React hooky
/__tests__              Testy (Vitest)
```

---

## Licence

MIT — používej, forkni, případně vylepšuj. Pokud ti appka pomohla, dej vědět. 💪
