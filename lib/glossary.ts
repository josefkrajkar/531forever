/**
 * Centrální slovník powerliftingových termínů a zkratek.
 * Použij <GlossaryTerm term="klíč"> pro zobrazení popoveru s vysvětlením.
 */

export type GlossaryKey =
  | "tm"
  | "1rm"
  | "e1rm"
  | "amrap"
  | "rpe"
  | "pr"
  | "leader"
  | "anchor"
  | "deload"
  | "tm_test"
  | "seventh_week"
  | "bbb"
  | "bbs"
  | "fsl"
  | "ssl"
  | "widowmaker"
  | "joker"
  | "wilks"
  | "dots"
  | "531"
  | "sbd"
  | "ohp"

interface GlossaryEntry {
  cs: { title: string; desc: string }
  en: { title: string; desc: string }
}

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  tm: {
    cs: {
      title: "Training Max (TM)",
      desc: "Tréninkové maximum — 90 % tvého skutečného maxima. Z TM se počítají všechny váhy v tréninku. Nižší hodnota chrání před přetrénováním.",
    },
    en: {
      title: "Training Max (TM)",
      desc: "Your working maximum — 90% of your true 1RM. All training weights are calculated from TM. The lower value protects against overtraining.",
    },
  },
  "1rm": {
    cs: {
      title: "1RM – One Rep Max",
      desc: "Maximální váha, kterou dokážeš zdvihnout jednou. Základ pro nastavení Training Maxu. Nemusíš ho testovat — aplikace ho odhadne z AMRAP výkonu.",
    },
    en: {
      title: "1RM – One Rep Max",
      desc: "The maximum weight you can lift once. The basis for setting your Training Max. You don't need to test it — the app estimates it from your AMRAP performance.",
    },
  },
  e1rm: {
    cs: {
      title: "e1RM – Odhadované maximum",
      desc: "Odhad tvého 1RM vypočítaný z AMRAP série. Čím více opakování zvládneš s danou vahou, tím vyšší je odhad maxima. Slouží ke sledování síly v čase.",
    },
    en: {
      title: "e1RM – Estimated 1RM",
      desc: "An estimate of your 1RM calculated from an AMRAP set. The more reps you get with a given weight, the higher the estimated max. Used to track strength over time.",
    },
  },
  amrap: {
    cs: {
      title: "AMRAP – Max opakování",
      desc: "As Many Reps As Possible. Poslední série každého hlavního cviku — uděláš maximum bezpečných opakování. Výsledek slouží k výpočtu e1RM a postupu Training Maxu.",
    },
    en: {
      title: "AMRAP – Max Reps",
      desc: "As Many Reps As Possible. The last set of each main lift — you do as many safe reps as possible. The result is used to calculate your e1RM and advance the Training Max.",
    },
  },
  rpe: {
    cs: {
      title: "RPE – Subjektivní náročnost",
      desc: "Rate of Perceived Exertion. Stupnice 1–10 popisující, jak moc ses dřel. RPE 10 = absolutní maximum, RPE 8 = zbývají 2 opakování v zásobě.",
    },
    en: {
      title: "RPE – Rate of Perceived Exertion",
      desc: "A 1–10 scale describing how hard you worked. RPE 10 = absolute maximum, RPE 8 = 2 reps left in the tank.",
    },
  },
  pr: {
    cs: {
      title: "PR – Osobní rekord",
      desc: "Personal Record. Tvůj dosavadní nejlepší výkon v daném cviku — ať už na váze, počtu opakování, nebo e1RM.",
    },
    en: {
      title: "PR – Personal Record",
      desc: "Your best performance so far in a given lift — whether in weight, reps, or estimated 1RM.",
    },
  },
  leader: {
    cs: {
      title: "Leader fáze",
      desc: "Objemová část cyklu 5/3/1 Forever. Dva Leader bloky (Leader 1 a Leader 2) po 3 týdnech. Vyšší počet sérií, nižší intenzita, cílem je nakumulovat objem.",
    },
    en: {
      title: "Leader Phase",
      desc: "The volume phase of the 5/3/1 Forever cycle. Two Leader blocks (Leader 1 and 2), each 3 weeks. Higher set count, lower intensity — the goal is volume accumulation.",
    },
  },
  anchor: {
    cs: {
      title: "Anchor fáze",
      desc: "Realizační část cyklu. Jeden 3týdenní blok po Leader fázích. Nižší objem, maximální intenzita — ženeš PRy na AMRAP setech.",
    },
    en: {
      title: "Anchor Phase",
      desc: "The realization phase of the cycle. One 3-week block after the Leader phases. Lower volume, maximum intensity — you push for PRs on AMRAP sets.",
    },
  },
  deload: {
    cs: {
      title: "Deload",
      desc: "Regenerační týden se sníženou zátěží. Váhy i objem jsou výrazně nižší. Cílem je odpočinek a příprava na další cyklus — ne progres.",
    },
    en: {
      title: "Deload",
      desc: "A recovery week with reduced load. Weights and volume are significantly lower. The goal is rest and preparation for the next cycle — not progress.",
    },
  },
  tm_test: {
    cs: {
      title: "TM Test",
      desc: "Test Training Maxu v 7. týdnu. Měl bys zvládnout 3–5 silných opakování. Potvrzuje, že tvůj TM je správně nastavený a umožňuje aplikaci přesně posunout váhy.",
    },
    en: {
      title: "TM Test",
      desc: "A Training Max test in the 7th week. You should be able to hit 3–5 strong reps. It confirms your TM is set correctly and lets the app advance your weights accurately.",
    },
  },
  seventh_week: {
    cs: {
      title: "7. týden – Přechodový protokol",
      desc: "Speciální týden mezi Leader a Anchor blokem. Volíš si TM Test (pokud jsi silný) nebo Deload (pokud potřebuješ odpočinek). Není to tréninkový týden — je to přechod.",
    },
    en: {
      title: "7th Week Protocol",
      desc: "A special week between the Leader and Anchor block. You choose TM Test (if you feel strong) or Deload (if you need rest). It's not a training week — it's a transition.",
    },
  },
  bbb: {
    cs: {
      title: "BBB – Boring But Big",
      desc: "Doplňková šablona: 5 sérií × 10 opakování na 50–65 % TM. Vysoký objem pro hypertrofii (svalový růst). Doporučena v Leader fázích.",
    },
    en: {
      title: "BBB – Boring But Big",
      desc: "Supplemental template: 5 sets × 10 reps at 50–65% TM. High volume for hypertrophy (muscle growth). Recommended in Leader phases.",
    },
  },
  bbs: {
    cs: {
      title: "BBS – Boring But Strong",
      desc: "Varianta BBB: 10 sérií × 5 opakování na FSL váhu. Kombinuje objem a sílu. Pro pokročilejší liftery v Leader fázích.",
    },
    en: {
      title: "BBS – Boring But Strong",
      desc: "A BBB variant: 10 sets × 5 reps at FSL weight. Combines volume and strength. For more advanced lifters in Leader phases.",
    },
  },
  fsl: {
    cs: {
      title: "FSL – First Set Last",
      desc: "Doplňková šablona: 3–5 sérií na váhu první (nejlehčí) pracovní série. Intenzivnější než BBB, méně objemu. Doporučena v Anchor fázích.",
    },
    en: {
      title: "FSL – First Set Last",
      desc: "Supplemental template: 3–5 sets at the weight of your first (lightest) working set. More intense than BBB, less volume. Recommended in Anchor phases.",
    },
  },
  ssl: {
    cs: {
      title: "SSL – Second Set Last",
      desc: "Varianta FSL: série na váhu druhé pracovní série. Vyšší intenzita než FSL. Pro pokročilé liftery hledající větší stimul v Anchor fázi.",
    },
    en: {
      title: "SSL – Second Set Last",
      desc: "An FSL variant: sets at the weight of your second working set. Higher intensity than FSL. For advanced lifters seeking more stimulus in the Anchor phase.",
    },
  },
  widowmaker: {
    cs: {
      title: "Widowmaker",
      desc: "Extrémně náročná doplňková série — 20 opakování na váhu první pracovní série. Testuješ mentální odolnost a aerobní kapacitu. Jen pro odvážné.",
    },
    en: {
      title: "Widowmaker",
      desc: "An extremely demanding supplemental set — 20 reps at your first working-set weight. Tests mental toughness and aerobic capacity. For the brave only.",
    },
  },
  joker: {
    cs: {
      title: "Joker sety",
      desc: "Extra těžké série navíc, které děláš pouze v dobrém dni. Přidáváš 5–10 % k váze a přidáváš série, dokud ti to jde. Nejsou povinné — jen pokud se cítíš silný.",
    },
    en: {
      title: "Joker Sets",
      desc: "Extra heavy sets you only do on a good day. You add 5–10% to the weight and keep going as long as it moves well. Not mandatory — only when you feel strong.",
    },
  },
  wilks: {
    cs: {
      title: "Wilks koeficient",
      desc: "Skóre normalizující sílu podle tělesné váhy a pohlaví. Umožňuje férové srovnání lifterů různých váhových kategorií. Čím vyšší, tím silnější jsi relativně ke své váze.",
    },
    en: {
      title: "Wilks Score",
      desc: "A score that normalizes strength by body weight and gender. Enables fair comparison between lifters of different weight classes. Higher = stronger relative to your body weight.",
    },
  },
  dots: {
    cs: {
      title: "DOTS koeficient",
      desc: "Modernější alternativa k Wilks. Přesnější pro extrémní váhové kategorie. Používají ho federace jako IPF pro srovnání lifterů na soutěžích.",
    },
    en: {
      title: "DOTS Score",
      desc: "A more modern alternative to Wilks. More accurate for extreme weight classes. Used by federations like the IPF to compare lifters at competitions.",
    },
  },
  "531": {
    cs: {
      title: "5/3/1 Forever",
      desc: "Silový program Jima Wendlera. Tři pracovní série s progresivními procenty: 5 × 65/75/85 %, 3 × 70/80/90 %, 5/3/1+ × 75/85/95 %. Poslední série je AMRAP.",
    },
    en: {
      title: "5/3/1 Forever",
      desc: "Jim Wendler's strength program. Three working sets with progressive percentages: 5 × 65/75/85%, 3 × 70/80/90%, 5/3/1+ × 75/85/95%. The last set is AMRAP.",
    },
  },
  sbd: {
    cs: {
      title: "SBD – Trojboj",
      desc: "Squat, Bench, Deadlift — tři disciplíny powerliftingu. SBD Total je součet maxim v dřepu, bench pressu a mrtvém tahu.",
    },
    en: {
      title: "SBD – Powerlifting Total",
      desc: "Squat, Bench, Deadlift — the three powerlifting disciplines. SBD Total is the sum of your maxes in squat, bench press, and deadlift.",
    },
  },
  ohp: {
    cs: {
      title: "OHP – Tlak nad hlavou",
      desc: "Overhead Press. Čtvrtý hlavní cvik 5/3/1 — tlak s činkou nad hlavu ve stoji. Buduje sílu ramen, tricepsů a celkovou stabilitu.",
    },
    en: {
      title: "OHP – Overhead Press",
      desc: "The fourth main 5/3/1 lift — pressing a barbell overhead while standing. Builds shoulder and triceps strength and overall stability.",
    },
  },
}
