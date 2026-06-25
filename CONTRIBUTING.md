# Jak přispět

Díky za zájem! Každý příspěvek je vítán — oprava chyby, nová funkce nebo jen upozornění na problém.

## Nahlášení chyby

Otevři [GitHub Issue](../../issues/new) a popiš:
- Co jsi dělal
- Co se stalo
- Co jsi očekával
- Verze prohlížeče / OS

## Návrh funkce

Otevři Issue s popisem nápadu. Před velkou implementací je lepší nejdřív prodiskutovat záměr — šetří to čas oběma stranám.

## Pull Request

1. Forkni repozitář a vytvoř větev z `main`:
   ```bash
   git checkout -b feat/nazev-funkce
   ```

2. Napiš kód. Drž se existujícího stylu (TypeScript, Tailwind, Convex patterns).

3. Spusť testy — všechny musí projít:
   ```bash
   npm run test:run
   ```

4. Pro netriviální logiku přidej testy do `__tests__/`.

5. Otevři PR s popisem co a proč jsi změnil.

## Co je vítáno

- Opravy chyb
- Nové doplňkové cviky do katalogu (`lib/accessory-catalog.ts`)
- Překlady (i18n zatím není, ale PR s návrhem architektury je vítán)
- Vylepšení UX pro mobilní zařízení
- Dokumentace a komentáře v kódu

## Co sem nepatří

- Změna 5/3/1 matematiky bez odkazu na Wendlerovu knihu — implementace záměrně sleduje knihu Forever
- Závislosti navíc bez jasného důvodu
- AI-generované PR bez pochopení kódu

## Lokální setup

Viz [README.md](README.md) — sekce *Fork & lokální setup*.

---

Otázky? Otevři Issue nebo napiš na josef.krajkar@mensa.cz.
