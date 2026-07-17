# PRODUCT.md — Generator Power Advisor (GPA)

> **Source of truth for the product.** This document guides every design and
> engineering decision. It evolves over time. Code should serve this vision;
> when code and this document disagree, resolve the disagreement deliberately
> (update one or the other), never silently.

**Product name:** Generator Power Advisor
**Brand shorthand:** GPA
**Type:** Installable, offline-first Progressive Web App (PWA), destined for the
Apple App Store and Google Play Store (via a thin native wrapper in a later phase).
**Repo:** `camper-power-calculator/` (folder name is historical; product is GPA).

---

## 1. Product Vision

Generator Power Advisor is an **intelligent decision-support app** that tells
people what they can safely power with a portable generator under real-world
conditions — heat, cold, altitude, startup surges, and dwindling fuel.

It is **not a calculator**. A calculator answers *"how many watts am I using?"*
GPA answers the questions people actually have:

- **What can I safely run right now?**
- **What should I avoid — and why?**
- **What should I temporarily turn off to make room?**
- **How much safety margin do I have left?**
- **How do heat and elevation change my generator's real output?**
- **What's the smartest way to use the power I have?**

The experience should feel like **an experienced electrician sitting beside you**
— while camping, RVing, tailgating, on a jobsite, or riding out a home power
outage — calm, clear, and trustworthy.

## 2. Mission Statement

> Give anyone with a portable generator the confidence of an expert — turning raw
> wattage into safe, plain-language decisions, anywhere, even with no signal.

## 3. Target Audience

| Segment | Situation | What they need |
|---|---|---|
| **RVers / boondockers** | Camping off-grid on generator power | Runtime, overnight confidence, fuel strategy |
| **Tailgaters / overlanders** | Short high-draw bursts (griddle, TV, coffee) | "Can I run this *and* that?" surge guidance |
| **Jobsite / trades** | Power tools + lights on a portable unit | Startup surge headroom, don't-trip guidance |
| **Home backup during outages** | Fridge, furnace blower, a few essentials | Prioritization: what to run, what to shed |
| **Prospective generator buyers** | Sizing a unit before purchase *(future)* | "Will a 3,600W unit run my stuff?" |

**Primary audience today:** RVers and boondockers (the current engine models this
deeply). Adjacent audiences are served as the generator/appliance model
generalizes (see Roadmap).

## 4. User Personas

- **"Boondocker Ben"** — Owns an RV, camps off-grid for days, runs a dual-fuel
  generator. Wants to know if he'll make it through the night and when to switch
  fuel. *(Fully served today.)*
- **"Outage Olivia"** — Suburban homeowner, buys a generator for storm season,
  nervous about overloading it or backfeeding. Wants a dead-simple "run this, not
  that" answer. *(Served after generalization.)*
- **"Jobsite Jamal"** — Contractor running a miter saw, compressor, and work
  lights off one unit. Cares about startup surge stacking. *(Served after
  generalization.)*
- **"Shopper Sam"** — Doesn't own a generator yet; wants to know what size to buy.
  *(Future "Generator Shopping Advisor.")*

## 5. Core Value Proposition

**Turn wattage into judgment.** Anyone can add up watts. GPA weighs running load,
the single largest startup surge, elevation derating, ambient heat, and remaining
fuel — then delivers a **safe / near-capacity / unsafe** verdict in plain language,
with the *reason* and the *fix*. Offline. On your phone. In seconds.

## 6. Brand Identity

**Personality:** Intelligent · Trustworthy · Helpful · Professional · Friendly ·
Modern · Outdoor-focused · Safety-conscious · Premium.

**Tone of voice:** Confident but never smug. Explains, doesn't lecture. Uses plain
words ("you have about 4 hours of headroom") over jargon ("2,880W continuous
derated capacity"). Safety-forward without fear-mongering.

**Visual direction (proposed — finalized in Phase 1):**
- A **deep slate/graphite** foundation (outdoor dusk, premium instrument panel)
  with a **single confident accent** for energy/action, and a disciplined
  **semantic traffic-light system** (green = safe, amber = near capacity,
  red = unsafe) reserved *only* for status so it always means the same thing.
- **Logo/mark:** the letters **GPA** paired with a bolt-in-gauge motif — energy
  (⚡) framed by a dial/meter, signaling "measured power." Works as a monochrome
  glyph for the app icon and favicon.
- **Typography:** system-native stack (San Francisco / Roboto / Segoe) for crisp,
  platform-correct, zero-dependency, offline rendering — the "Apple utility" feel
  comes from spacing, weight, and hierarchy, not a downloaded font.

## 7. Design Principles

1. **Answer first, numbers second.** Lead with the verdict and the reason; put raw
   watts in a supporting role.
2. **One accent, semantic color discipline.** Green/amber/red mean status and
   nothing else, everywhere.
3. **Glanceable.** The core answer must be readable in under two seconds, one-handed,
   in sunlight.
4. **Explain every "no."** A blocked action always says *why* and *what to change*.
5. **Mobile-first, thumb-first.** Touch targets ≥ 44px; primary actions in reach.
6. **Offline is a feature, not a fallback.** Everything works with no signal.
7. **No regressions, ever.** Every existing calculation and workflow keeps working.
8. **Accessible by default.** WCAG AA contrast, real focus states, reduced-motion
   respect, semantic HTML, screen-reader labels.
9. **No build step (for now).** Plain HTML/CSS/vanilla JS deploys straight to
   GitHub Pages. Keep it that way until a native wrapper genuinely requires more.

## 8. Technical Architecture Overview

- **Stack:** Vanilla JS (no framework, no bundler), single `app.js`, single
  `style.css`, single `index.html`. State in a plain `state` object persisted to
  `localStorage`. Rendering is imperative `innerHTML` composition per tab.
- **PWA:** `manifest.json` + `service-worker.js` (network-first, cache fallback).
  Installable; fully offline after first load.
- **Calculation engine (the crown jewels — do not disturb casually):**
  - `APPLIANCES` — appliance running/surge watts (single source of truth).
  - `GEN` — generator running/peak ratings per fuel (gas/propane).
  - `deratedGen(elevFt)` — ~3.5% output loss per 1,000 ft.
  - `calcLoads()` — sums running load + largest single surge + battery-assist load.
  - `fuelStatus()` — good / near / over vs. running & peak limits.
  - `estFuelBurn()` / fuel tracker — runtime, reserve, combined, overnight confidence.
  - WEN DF360iX **Auto Fuel Selection** model (propane priority, gas reserve, no
    auto-failover). See `PROJECT_VISION.md`.
  - `weatherImpact()` + A/C duty-cycle table — ambient-aware overnight confidence.
- **Distribution path to the stores (future):** wrap the PWA (Capacitor or a
  WKWebView/Trusted-Web-Activity shell) once the product experience is store-ready.
- **Deployment:** GitHub Pages; `git push` fans out to GitHub + lab GitLab.

## 9. Product Roadmap

**Phase 1 — Commercial identity & experience *(done)***
Rebrand to GPA; full visual redesign; redesigned home + results experience with
plain-language guidance; polish. **Engine unchanged.**

**Phase 2 — Generator database & swappable ratings *(done)***
`GENERATORS` data model drives the whole engine from the *selected* unit. Curated
list of dual-fuel and gas-only units (WEN, Champion, Westinghouse, Honda, Predator,
Generac) + user-defined **custom generators** (persisted). Propane is a per-generator
capability: gas-only units cleanly hide all propane UI across Calculator, Fuel
Tracker, Reference, and About. WEN DF360iX remains the default with byte-identical
numbers. Covers the "**Saved generators**" backlog item (custom units) as well.

**Phase 3 — Searchable generator database (offline) *(done)***
`GENERATOR_CATALOG` (~38 common units across Honda, Yamaha, Champion, Westinghouse,
WEN, Predator, Generac, DuroMax, Firman, Briggs, A-iPower, Pulsar) built via a compact
`mkGen()` helper. Picker gained a **search box** (Popular shortlist when empty) →
tapping a result opens a **Confirm Specs** panel (full ratings + "verify against your
manual") with **Confirm & Use** / **Adjust values** (clone→editable custom) / Back.
Chosen approach: **Hybrid** — offline searchable DB now; live online lookup deferred
to Phase 4. All catalog specs are typical-published, user-confirmed and editable.

**Phase 4 — Live online spec lookup *(planned, needs backend)***
"Type any make/model → fetch specs from the internet → confirm." A static offline PWA
can't securely hold an API key or scrape (CORS), so this needs a small **serverless
proxy** (Cloudflare/Vercel/Netlify) calling an LLM (Claude) or specs source. Network
only at lookup time; results shown as **AI-sourced, mandatory confirm**, then cached
locally. This is the second half of the Hybrid plan.

**Phase 5+ — planning only, not yet scheduled:**
- **Saved RV / setup profiles** — multiple rigs/appliance sets per user (the
  appliance list + rig-specific rows are still a single default profile today).
- **Home backup mode** — outage-oriented flow (essentials-first load shedding).
- **AI recommendations** — "smartest way to use your power" suggestions.
- **Smart appliance suggestions** — what to add/drop for a target runtime.
- **Weather visualization** — richer forecast-driven guidance.
- **Fuel comparisons** — cost/runtime tradeoffs across fuels.
- **Generator shopping advisor** — size-a-unit-before-you-buy flow.
- **Solar & battery planning** — hybrid power modeling.
- **Offline maps of elevation**, **push notifications**, **cloud sync**.

> Phases 4+ are **not** implemented yet. They live here to shape today's architecture
> (e.g., keep generator ratings swappable, keep appliances data-driven).

## 10. Monetization Ideas (exploratory)

- **Free core, one-time "Pro" unlock** — generator database, saved profiles, home
  backup mode, AI suggestions. (Utility buyers dislike subscriptions; a fair
  one-time unlock fits the premium-tool feel.)
- **Optional subscription** only if genuinely recurring value exists (cloud sync,
  live weather intelligence).
- **Affiliate "shopping advisor"** — transparent, clearly-labeled generator
  recommendations. Never at the expense of trust.
- Principle: **never sell the user's safety short for a dollar.** Monetize
  convenience and breadth, not the core answer.

## 11. Competitive Differentiators

- **Judgment, not arithmetic** — verdicts + reasons + fixes, not a watt tally.
- **Real-world physics** — elevation derating, ambient duty cycle, largest-single
  startup surge, dual-fuel behavior. Most "generator calculators" ignore all of it.
- **Offline-first** — works in the backcountry and during outages, exactly when
  connectivity fails.
- **Premium, glanceable UX** — Apple-quality clarity vs. spreadsheet-grade tools.
- **Trustworthy voice** — teaches the user, building confidence and word-of-mouth.

## 12. Definition of Success

- A first-time user understands what the app is for **within 5 seconds** of opening.
- A user can answer "can I run this?" **in one glance**, and understands *why* when
  the answer is no.
- Users **recommend it unprompted** after a real trip or outage.
- App Store quality bar: could be **featured** as a utility without embarrassment.
- **Zero regressions** across phases; every prior calculation remains correct.
- Would a user **happily pay** for it? If not yet, that's the gap to close.

## 13. Prioritized Product Backlog

**P0 — Phase 1 (now):**
1. Rebrand everything to Generator Power Advisor / GPA (title, header, manifest,
   meta, docs, PWA identity).
2. Visual identity: color system, typography scale, logo/mark, app icon, favicon,
   splash.
3. Redesigned components: cards, buttons, forms, toggles, status badges, nav.
4. Home/landing experience: name + tagline + instant value + clear entry point.
5. Results experience: verdict-first (Safe / Near Capacity / Unsafe) with load,
   capacity remaining, safety margin, surge evaluation, environmental derating.
6. Plain-language "why" explanations for unsafe/near-capacity states.
7. Polish: transitions, empty/loading states, validation, error messages, a11y,
   responsive desktop + mobile, dark mode.
8. About page reflecting the GPA brand.

**P1 — near-term after Phase 1:** generator database + swappable ratings; saved
profiles; home backup mode.

**P2 — later:** AI recommendations, shopping advisor, solar/battery planning,
cloud sync, native store wrappers.

## 14. Constraints & Guardrails

- **Preserve every existing calculation** unless there is a documented technical
  reason; if a calculation changes, explain *why* first.
- **One milestone at a time**; each leaves the app fully working. No half-built
  features, no regressions.
- **No new runtime dependencies / no build step** in Phase 1.
- **Single-rig engine stays** in Phase 1; generalization is a deliberate later phase.

## 15. Future Feature Ideas (parking lot)

Trip planner & itinerary-aware power budgeting · shareable "power plan" cards ·
Apple Watch / widget glance · voice ("hey, can I run the microwave?") · CO-safety
reminders & run-time logging · community-shared tested appliance combos ·
multi-generator parallel modeling · localization.

---

*Document owner: the GPA product team (acting: PM / UX / UI / Eng / QA / Docs).*
*Last meaningful update: Phase 1 kickoff.*
