# Project Brief: Open-Source F-1 Visa Compliance Engine

## What this is

An open-source, agent-native compliance engine for F-1 international students that tracks CPT/OPT eligibility, unemployment day-counting, STEM OPT extension windows, and I-20 renewal triggers. Exposed both as a normal web app and as an MCP server, so any MCP-compatible AI client (Claude Code, Claude Desktop, Cursor) can query compliance status programmatically.

Portfolio-grade project. Code quality, architecture clarity, and test coverage matter as much as functionality — a senior engineer or recruiter should be able to skim the repo and understand the design in under two minutes.

## Tech stack (fixed — don't change without asking)

- Backend: TypeScript, Fastify, SQLite (better-sqlite3 or Drizzle ORM)
- Rule engine: pure TypeScript, no LLM calls — must be deterministic and unit-testable
- MCP layer: `@modelcontextprotocol/sdk`
- Event bus: in-process event emitter now, structured so it could later move to Kafka/Redis Streams — use the transactional outbox pattern (write event + state change in the same DB transaction, a separate dispatcher polls and publishes)
- Frontend: React + TypeScript, minimal and clean, no heavy UI framework — this is a dashboard, not a marketing site
- LLM use (Claude API): ONLY for two things — (1) natural-language explanation of a rule violation for a non-technical user, generated from the structured rule-engine output, never as the source of truth, and (2) a chat interface that answers student questions by calling the MCP tools, not by freelancing an answer
- Deployment target: Fly.io or Railway, containerized

## Non-negotiable design principles

1. **The rule engine is the core of this project.** Every compliance rule must be:
   - Implemented as a pure function with typed inputs/outputs
   - Unit tested with real edge cases (leap years, partial-day CPT authorization, STEM extension eligibility boundary cases)
   - Versioned — each rule has a `sourceCitation` field pointing to the specific USCIS/SEVP regulation it encodes, and a `version` so future regulation changes don't silently overwrite history

2. **Never let the LLM compute a date, a day-count, or an eligibility determination.** The LLM explains what the rule engine already decided.

3. **Every flag/alert must carry an audit trail**: which rule fired, what inputs it used, what regulation it cites, and a timestamp.

4. **MCP tools should be genuinely useful standalone**, not just API wrappers. Initial tool set:
   - `check_cpt_eligibility(studentId)` — eligibility status + reasoning
   - `calculate_unemployment_days(studentId, asOfDate)` — running day count + days remaining before violation
   - `simulate_opt_timeline(studentId, proposedStartDate)` — full timeline projection with risk flags
   - `get_compliance_audit_trail(studentId)` — full reasoning history for a student

5. **No real student data, ever.** Build with a synthetic data generator from day one.

## Success criteria for v1

- Rule engine: >90% test coverage, all rules cite their source regulation
- MCP server: all four tools above working, tested with the MCP inspector
- Frontend: dashboard showing a synthetic cohort with live risk flags, detail view with full audit trail per student
- Deployed, public, no login wall, running on synthetic data
- README with accurate architecture diagram and "why I built this" section

## Style notes

- Concise, human commit messages and code comments. No filler.
- No em-dashes in generated docs/comments.
- Prefer explicit types over `any`, and prefer small composable functions over large ones.
