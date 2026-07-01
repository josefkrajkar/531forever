import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import {
  Dumbbell,
  Calculator,
  Timer,
  TrendingUp,
  LineChart,
  WifiOff,
  Download,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react"
import { getServerI18n } from "@/lib/i18n-server"
import { isSupportedLang, DEFAULT_LANG } from "@/lib/i18n-config"
import { OG_IMAGE } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const rawLang = cookieStore.get("lang")?.value
  const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG
  const i18n = await getServerI18n(lang)

  const ogLocale = lang === "cs" ? "cs_CZ" : "en_US"
  const title = i18n.t("landing.meta.title")
  const description = i18n.t("landing.meta.description")
  const ogTitle = i18n.t("app.name") + " — 5/3/1"

  return {
    title,
    description,
    keywords: [
      "5/3/1",
      "531",
      "Wendler",
      "powerlifting",
      "plate calculator",
      "training max",
      "5/3/1 Forever",
    ],
    openGraph: {
      title: ogTitle,
      description,
      type: "website",
      locale: ogLocale,
      images: [
        {
          url: OG_IMAGE,
          width: 1344,
          height: 768,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [OG_IMAGE],
    },
  }
}

export default async function LandingPage() {
  const cookieStore = await cookies()
  const rawLang = cookieStore.get("lang")?.value
  const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG
  const i18n = await getServerI18n(lang)

  const FEATURES = [
    {
      icon: Dumbbell,
      title: i18n.t("landing.features.0.title"),
      desc: i18n.t("landing.features.0.desc"),
    },
    {
      icon: TrendingUp,
      title: i18n.t("landing.features.1.title"),
      desc: i18n.t("landing.features.1.desc"),
    },
    {
      icon: Calculator,
      title: i18n.t("landing.features.2.title"),
      desc: i18n.t("landing.features.2.desc"),
    },
    {
      icon: Timer,
      title: i18n.t("landing.features.3.title"),
      desc: i18n.t("landing.features.3.desc"),
    },
    {
      icon: LineChart,
      title: i18n.t("landing.features.4.title"),
      desc: i18n.t("landing.features.4.desc"),
    },
    {
      icon: WifiOff,
      title: i18n.t("landing.features.5.title"),
      desc: i18n.t("landing.features.5.desc"),
    },
  ]

  const STEPS = [
    {
      num: "01",
      title: i18n.t("landing.steps.0.title"),
      desc: i18n.t("landing.steps.0.desc"),
    },
    {
      num: "02",
      title: i18n.t("landing.steps.1.title"),
      desc: i18n.t("landing.steps.1.desc"),
    },
    {
      num: "03",
      title: i18n.t("landing.steps.2.title"),
      desc: i18n.t("landing.steps.2.desc"),
    },
  ]

  const DIFFERENTIATORS = [
    {
      title: i18n.t("landing.differentiators.0.title"),
      desc: i18n.t("landing.differentiators.0.desc"),
    },
    {
      title: i18n.t("landing.differentiators.1.title"),
      desc: i18n.t("landing.differentiators.1.desc"),
    },
    {
      title: i18n.t("landing.differentiators.2.title"),
      desc: i18n.t("landing.differentiators.2.desc"),
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/icons/icon-192.png"
              alt="531Forever"
              className="w-8 h-8 rounded-sm"
            />
            <span className="font-heading font-extrabold uppercase tracking-widest text-sm">
              {i18n.t("app.name")}
            </span>
          </div>
          <Link
            href="/app"
            className="font-heading font-bold uppercase tracking-widest text-xs bg-secondary hover:bg-secondary/70 px-4 py-2 rounded-sm transition-colors"
          >
            {i18n.t("landing.nav.signInLink")}
          </Link>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 left-1/2 -translate-x-1/2 w-[120%] h-[120%] bg-gradient-radial from-primary/15 via-transparent to-transparent"
        />
        <div className="relative max-w-5xl mx-auto px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-widest text-primary mb-5">
              <span className="w-6 h-px bg-primary" />
              {i18n.t("landing.hero.eyebrow")}
            </p>
            <h1 className="font-heading font-extrabold uppercase tracking-tight text-5xl sm:text-6xl leading-[0.95] mb-6">
              {i18n.t("landing.hero.heading")}
              <span className="block text-primary">{i18n.t("landing.hero.headingAccent")}</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-md">
              {i18n.t("landing.hero.subheading")}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest text-sm px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                {i18n.t("landing.hero.ctaPrimary")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#jak-to-funguje"
                className="font-heading font-bold uppercase tracking-widest text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {i18n.t("landing.hero.ctaSecondary")}
              </a>
            </div>
          </div>

          {/* Mockup pracovní série — vychází z reálné UI appky */}
          <div className="lg:justify-self-end w-full max-w-sm">
            <div className="bg-card border border-border rounded-sm p-5 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {i18n.t("landing.mockup.weekDay")}
                  </p>
                  <p className="font-heading font-extrabold uppercase tracking-widest text-xl">
                    {i18n.t("lifts.squat")}
                  </p>
                </div>
                <div className="text-right bg-secondary rounded px-3 py-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {i18n.t("landing.mockup.setsLabel")}
                  </p>
                  <p className="font-heading font-bold text-xl">
                    <span className="text-primary">3</span>
                    <span className="text-muted-foreground">/3</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { w: "100", r: "5", done: true, amrap: false },
                  { w: "115", r: "5", done: true, amrap: false },
                  { w: "130", r: "5+", done: true, amrap: true },
                ].map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded border ${
                      s.amrap
                        ? "bg-primary/10 border-primary/40"
                        : "bg-background border-primary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary border-2 border-primary text-primary-foreground flex items-center justify-center text-sm">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </div>
                      <div>
                        <p className="font-heading font-bold text-lg leading-none">
                          {s.w} kg × {s.r}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.amrap ? i18n.t("landing.mockup.amrapSet") : i18n.t("landing.mockup.workingSet")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                {i18n.t("landing.mockup.plateHint")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problém / hodnota ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16 sm:py-20 text-center">
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-3xl sm:text-4xl mb-4">
          {i18n.t("landing.problem.heading")}
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
          {i18n.t("landing.problem.body")}
        </p>
      </section>

      {/* ─── Comparison: Spreadsheet vs. 531Forever ──────── */}
      <section className="border-y border-border bg-card/30">
        <div className="max-w-5xl mx-auto px-5 py-16 sm:py-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading font-extrabold uppercase tracking-tight text-2xl sm:text-3xl text-center mb-10">
              {i18n.t("landing.comparison.title")}
            </h2>
            <div className="grid grid-cols-2 divide-x divide-border border border-border rounded-sm overflow-hidden text-sm">
              {/* Header */}
              <div className="bg-secondary/40 px-5 py-3 font-heading font-bold uppercase tracking-widest text-xs text-muted-foreground">
                {i18n.t("landing.comparison.spreadsheetHeader")}
              </div>
              <div className="bg-primary/10 px-5 py-3 font-heading font-bold uppercase tracking-widest text-xs text-primary flex items-center gap-1.5">
                {i18n.t("landing.comparison.appHeader")}
              </div>
              {(i18n.t("landing.comparison.rows", { returnObjects: true }) as Array<{ bad: string; good: string }>).flatMap(
                ({ bad, good }) => [
                  <div key={`bad-${bad}`} className="px-5 py-3.5 border-t border-border text-muted-foreground/70 flex items-start gap-2">
                    <span className="text-destructive/60 mt-0.5">✗</span>
                    {bad}
                  </div>,
                  <div key={`good-${good}`} className="px-5 py-3.5 border-t border-border flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    {good}
                  </div>,
                ]
              )}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest text-sm px-6 py-3.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                {i18n.t("landing.comparison.cta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Funkce ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/30">
        <div className="max-w-5xl mx-auto px-5 py-16 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-sm overflow-hidden">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-background p-6">
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-bold uppercase tracking-widest text-sm mb-2">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Jak to funguje ─────────────────────────────────── */}
      <section id="jak-to-funguje" className="max-w-5xl mx-auto px-5 py-16 sm:py-24">
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-3xl sm:text-4xl text-center mb-12">
          {i18n.t("landing.howItWorks.heading")}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="relative">
              <span className="font-heading font-extrabold text-5xl text-primary/20 leading-none">
                {num}
              </span>
              <h3 className="font-heading font-bold uppercase tracking-widest text-lg mt-3 mb-2">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Proč právě tahle ───────────────────────────────── */}
      <section className="border-y border-border bg-card/30">
        <div className="max-w-5xl mx-auto px-5 py-16 sm:py-20">
          <div className="grid md:grid-cols-3 gap-px bg-border rounded-sm overflow-hidden">
            {DIFFERENTIATORS.map(({ title, desc }) => (
              <div key={title} className="bg-background p-6">
                <ShieldCheck className="w-5 h-5 text-primary mb-4" />
                <h3 className="font-heading font-bold uppercase tracking-widest text-sm mb-2">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Závěrečné CTA ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-20 sm:py-28 text-center">
        <Download className="w-8 h-8 text-primary mx-auto mb-6" />
        <h2 className="font-heading font-extrabold uppercase tracking-tight text-4xl sm:text-5xl mb-5">
          {i18n.t("landing.cta.heading")}
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          {i18n.t("landing.cta.body")}
        </p>
        <Link
          href="/app"
          className="group inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest text-sm px-8 py-4 rounded-sm hover:opacity-90 transition-opacity"
        >
          {i18n.t("landing.cta.button")}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </section>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Dumbbell className="w-4 h-4" />
            <span className="font-heading font-bold uppercase tracking-widest text-xs">
              {i18n.t("app.name")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/josefkrajkar/531forever"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <p className="text-xs text-muted-foreground/60">
              {i18n.t("landing.footer.legal")}
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
