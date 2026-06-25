// Service Worker pro Silový deník — app-shell cache
// Verze cache — při každém releasu inkrementuj CACHE_VERSION
const CACHE_VERSION = "v1"
const CACHE_NAME = `silovy-denik-${CACHE_VERSION}`

// Assety, které se precachují při instalaci SW (app-shell)
// POZOR: "/" zde záměrně není — precachovaná "/" by po deployi odkazovala na staré chunky.
// "/" se cachuje dynamicky při první úspěšné navigaci (viz navigation handler níže).
// Omezení: po nasazení nové verze je potřeba jedna online návštěva, aby se offline fallback aktualizoval.
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
]

// ─── Install ───────────────────────────────────────────────────────────────
// Stáhne app-shell assety a aktivuje SW okamžitě (skipWaiting).
self.addEventListener("install", (event) => {
  console.log("[SW] Install — cache:", CACHE_NAME)
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ──────────────────────────────────────────────────────────────
// Smaže staré verze cache a převezme kontrolu nad všemi taby.
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate — čistím staré cache")
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Mažu starou cache:", key)
              return caches.delete(key)
            })
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Přeskočit non-GET requesty (POST, PUT, …)
  if (request.method !== "GET") return

  // Přeskočit cross-origin requesty (Convex WebSocket / API na convex.cloud)
  if (url.origin !== self.location.origin) return

  // Přeskočit Convex HTTP action endpointy na same-origin (/api/*)
  // a Next.js interní endpointy
  if (url.pathname.startsWith("/api/")) return

  // ── Navigace (HTML stránky) — network-first s fallbackem na cached "/" ──
  // Při úspěšné síťové odpovědi ukládáme pod URL požadavku; pokud jde o "/",
  // slouží zároveň jako offline fallback pro všechny navigace (konzistentní
  // s chunky stahovanými týmž buildem). Pokud nejde o "/", uložíme response
  // i pod "/", čímž zajistíme, že fallback vždy odráží poslední úspěšný build.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Úspěšná síťová odpověď — aktualizuj cache a vrať
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              // Ulož pod přesnou URL navigace
              cache.put(request, response.clone())
              // Vždy aktualizuj "/" jako offline fallback — tím je cachovaná "/" vždy
              // z posledního úspěšného buildu, nikoli z doby instalace SW.
              if (url.pathname !== "/") {
                cache.put("/", response.clone())
              }
            })
          }
          return response
        })
        .catch(() => {
          // Offline — vrať nejdřív cachovanu URL, pak "/" (app-shell)
          console.log("[SW] Offline — servuji app-shell z cache")
          return caches.open(CACHE_NAME).then((cache) =>
            cache.match(request).then(
              (cached) =>
                cached ||
                cache.match("/").then(
                  (fallback) =>
                    fallback ||
                    new Response("Offline — aplikace není dostupná", {
                      status: 503,
                      headers: { "Content-Type": "text/plain; charset=utf-8" },
                    })
                )
            )
          )
        })
    )
    return
  }

  // ── Statické hashed assety Next.js (/_next/static/) — cache-first ──────
  // Tyto soubory mají hash v názvu → jsou immutable, stačí cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // ── Ikony a manifest — cache-first s runtime doplněním ─────────────────
  // Nehashované soubory (ikony, manifest) — stale-while-revalidate:
  // vrátí z cache okamžitě, na pozadí aktualizuje.
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          // Vrátí cached verzi okamžitě; pokud není, čeká na síť
          return cached || networkFetch
        })
      )
    )
    return
  }

  // Ostatní same-origin GET requesty — jen síť (žádná cache)
})
