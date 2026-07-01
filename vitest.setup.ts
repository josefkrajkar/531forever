import "@testing-library/jest-dom/vitest"

// Inicializace i18n pro komponentové testy — useTranslation() jinak vrací holé klíče.
// Komponentové testy asertují ČESKÉ řetězce, proto jazyk explicitně přepneme na "cs".
// (lib/i18n.ts se nově inicializuje na DEFAULT_LANG = "en" kvůli hydration-safe SSR,
//  takže bez tohoto přepnutí by testy dostávaly anglické texty.)
import i18n from "@/lib/i18n"
i18n.changeLanguage("cs")
