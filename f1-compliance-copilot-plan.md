# F-1 Compliance Copilot — Project Plan

## What this is
A personal compliance *tracker and flagging tool* for F-1 students navigating CPT/OPT rules.
It computes (day counts, eligibility windows, conflict checks) and cites the source rule —
it does NOT give legal advice or render legal judgment calls. Every user-facing output must
carry a visible disclaimer directing the user to their DSO/ISSS office or an immigration
attorney for anything status-affecting.

## Tech stack
- Backend: TypeScript + Node.js + Fastify
- Core logic: pure functions (date arithmetic, eligibility rules) — framework-free, heavily unit tested
- Rules knowledge base: versioned YAML files in-repo, not a database
- Agent/Q&A layer: Claude API (Sonnet) + MCP server exposing a "rules lookup" tool
- Storage: SQLite (file-based, single-user MVP)
- Frontend: React + Vite + Tailwind
- Hosting (later, not MVP-blocking): Vercel/Netlify (frontend), Fly.io/Render (backend)

## Non-negotiable constraints
1. No feature ever states "you are compliant" or "this is legal" as a bare conclusion.
   Every risk/status output includes: the computed fact, the rule it's based on (with
   citation to source), and a disclaimer.
2. Rules data lives in versioned files with an `effective_date` and `source_url` field.
   Application logic reads from this data — thresholds are never hardcoded in TS.
3. Every date-math function gets unit tests with edge cases (leap years, timezone
   boundaries, inclusive/exclusive day counting) before it's wired into the API.

---

## Phase 1 — Core engine (MVP, no UI, no agent)

**Goal:** a working day-counting and eligibility engine you can call from a script or test file.

### 1.1 Project scaffold
- [ ] `npm init`, TypeScript config, Fastify skeleton, vitest (or jest) for testing
- [ ] Folder structure:
  ```
  src/
    engine/          <- pure functions, no I/O
      unemployment-clock.ts
      cpt-tracker.ts
      concurrent-employment.ts
    rules/           <- versioned YAML rule data
      opt-unemployment.yaml
      cpt-authorization.yaml
      d-s-transition-2026.yaml
    data/            <- SQLite schema + access layer
    api/             <- Fastify routes (thin, call engine functions)
    mcp/             <- MCP server exposing rules-lookup tool (Phase 3)
  tests/
  ```

### 1.2 Rules data files (write these first — they define the domain model)

All three YAML files must conform to this shared shape, enforced by a TypeScript interface
in `src/rules/types.ts` and validated at load time (throw on missing required fields):

```ts
interface RuleFile {
  topic: string;           // machine key, e.g. "opt-unemployment"
  effective_date: string;  // ISO 8601, e.g. "2024-01-01"
  source_url: string;      // canonical federal/SEVP URL
  disclaimer: string;      // full disclaimer text shown in UI for this rule topic
  rules: Array<{
    id: string;            // stable slug, e.g. "standard-opt-unemployment-cap"
    summary: string;       // one sentence, plain English
    threshold?: number;    // numeric limit if applicable (days, months)
    unit?: 'days' | 'months';
    citation: string;      // "8 CFR § 214.2(f)(10)(ii)" or equivalent
  }>;
}
```

- [ ] `opt-unemployment.yaml`: 90-day standard OPT limit, 150-day cap with STEM extension,
      what counts as "unemployed," citation to 8 CFR § 214.2(f)(10)(ii) / SEVP guidance
- [ ] `cpt-authorization.yaml`: full-time vs part-time CPT definitions, the "12+ months
      full-time CPT eliminates OPT eligibility" rule, per-employer authorization scoping
- [ ] `d-s-transition-2026.yaml`: the Sept 15, 2026 fixed-admission-period rule — transition
      provisions, March 18, 2027 filing deadline for pending D/S students, citation to the
      DHS final rule / Federal Register entry

### 1.3 Engine functions (pure, unit-tested)
- [ ] `computeUnemploymentDays(employmentPeriods, optWindow): { usedDays, remainingDays, status }`
- [ ] `checkCptEligibilityImpact(cptPeriods): { totalFullTimeMonths, opEligibilityAtRisk: boolean }`
- [ ] `checkConcurrentEmploymentConflicts(roles: Role[]): Conflict[]`
      — this one's for you personally: flag overlapping CPT/OPT authorizations across
      multiple concurrent roles.
      `Conflict` shape:
      ```ts
      interface Conflict {
        roleIds: [string, string];   // the two roles whose authorizations overlap
        overlapStart: string;        // ISO 8601 date
        overlapEnd: string;          // ISO 8601 date (same as overlapStart if single day)
        ruleId: string;              // slug from RuleFile.rules[].id that is violated
        description: string;         // human-readable explanation of the conflict
      }
      ```
- [ ] `checkDsTransitionStatus(admissionRecord): { regime: 'D/S' | 'fixed-date', deadlines }`

### 1.4 Tests
- [ ] Edge cases: employment gap spanning a leap day, employment period with no end date
      (currently employed), overlapping authorization periods, exactly-at-threshold days (89
      vs 90 vs 91)

**Exit criteria for Phase 1:** you can run a script with a fake employment history and get
back correct day counts and flags, verified against hand-calculated expected values.

---

## Phase 2 — Data layer + REST API

- [ ] SQLite schema: `employment_periods`, `authorizations` (CPT/OPT/STEM-OPT), `user_profile`
      (program dates, degree level, visa admission type)
- [ ] Fastify routes: `POST /employment`, `GET /status` (returns all computed flags), `GET /rules/:topic`
- [ ] Wire engine functions to the API — routes stay thin, all logic lives in `engine/`
- [ ] Basic auth/session if you want this usable beyond just yourself locally (can defer —
      single-user local-only is fine for MVP). **Auth must be implemented before Phase 5
      public deployment — do not ship without it.**

**Exit criteria:** you can POST your own real employment history and GET back accurate status.

---

## Phase 3 — MCP server + agent layer

- [ ] Build an MCP server using the official `@modelcontextprotocol/sdk` TypeScript SDK
      (see https://github.com/modelcontextprotocol/typescript-sdk for server examples) exposing:
  - `lookup_rule(topic)` — reads from the YAML rules corpus, returns rule text + citation
  - `get_compliance_status(userId)` — calls into Phase 2 API, returns computed status
  - `fetch_immigration_news()` — fetches recent USCIS/DHS/SEVP announcements via a web
    search MCP (Brave Search or Perplexity); **used only for the news panel, never for
    compliance answers**
- [ ] Claude API integration: takes a plain-English question, calls `lookup_rule` +
      `get_compliance_status` as needed, composes an answer that must include citations
      and the standard disclaimer
- [ ] System prompt constraint: the agent must refuse to answer novel legal questions
      outside the rules corpus and instead say "this isn't covered by what I can verify —
      talk to your DSO." No improvising rule interpretations.
- [ ] System prompt constraint: `fetch_immigration_news` results must **never** be used
      when answering compliance questions — they are informational only and must be
      displayed in a separate UI panel with a clear "unverified — check official sources
      before acting" label.

**Exit criteria:** you can ask "can I work a second part-time job on top of my CPT role?"
and get an answer citing the specific rule and your specific tracked data. The news panel
shows recent USCIS/DHS announcements independently.

---

## Phase 4 — Frontend

- [ ] React + Vite + Tailwind
- [ ] Views: timeline of employment/authorization periods, a "days remaining" gauge for
      OPT unemployment clock, a form to log new periods, a chat box wired to the agent
- [ ] Live news panel: a separate read-only section that displays recent USCIS/DHS/SEVP
      announcements fetched via `fetch_immigration_news`. Must be visually distinct from
      the compliance dashboard — different background, a persistent "Informational only —
      not verified compliance guidance" label, and no connection to the engine output.
- [ ] Disclaimer banner, persistent, not dismissible-forever. Banner text is sourced from
      the `disclaimer` field of the loaded `RuleFile` objects (not hardcoded in the UI),
      so updating disclaimer language only requires editing the YAML files.

**Exit criteria:** you can use this yourself day-to-day instead of a spreadsheet.

---

## Phase 5 — Ship
- [ ] README with clear scope/liability framing up front
- [ ] Open source the repo
- [ ] Deploy: Vercel (frontend) + Fly.io/Render (backend + MCP server)
- [ ] Submit MCP server to the official registry + mcp.so
- [ ] Post in F-1/international student communities (r/f1visa, university international
      student groups) — this audience actively searches for this and has no good option today

---

## Suggested build order for a Claude Code session
Work top-to-bottom through Phase 1 first, fully tested, before touching the API or UI.
The engine is the trust-critical part — get it right in isolation before wiring anything
around it. Do not let Phase 3's agent layer improvise on rules; it should only ever surface
what's in the YAML corpus plus computed facts from Phase 1/2.
