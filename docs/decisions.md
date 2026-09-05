# Architecture Decisions

## ADR-001: Fresh monorepo, retire the SIH- prototype

**Date:** 2026-09-05

**Context:** An existing prototype (`../SIH-`) implements a Vite + React + Tailwind
frontend with Supabase for auth/hosting — a static login/dashboard shell with no real
backend, ML, or data pipeline. SIH26102's brief calls for a specific stack (Next.js +
FastAPI + self-hosted PostgreSQL/PostGIS/pgvector) built around real anomaly detection,
entity resolution, risk scoring, and an investigation workflow.

**Decision:** Build a fresh monorepo (`mplads-intelligence/`) matching the brief's stack
exactly, rather than adapting the Vite/Supabase prototype. The prototype's visual
language (navy/lime government theme, card layout ideas) may inform the new frontend's
design, but no code is carried over. Supabase is dropped in favor of self-hosted
Postgres so the platform can use PostGIS (geospatial peer-group/cluster queries) and
pgvector (embedding similarity search) directly in the primary database, and so
role-based access (ADMIN/OFFICER/ANALYST/VIEWER) is implemented in the app rather than
depending on a third-party auth provider's model.

**Consequence:** The SIH- prototype is left untouched as reference material, not deleted.

## ADR-002: Phased delivery, foundation first

**Decision:** Follow the brief's own 12-phase implementation order (foundation → data →
entity resolution → rule engine → ML → risk engine → graph → APIs → dashboard → LLM
assistant → investigation workflow → testing/polish), checking in with the user after
each major phase rather than attempting the full system in one pass. Phase 1 (this
commit) is scaffold-only: no business logic, no fabricated data or metrics. From the
Phase 3→4 transition onward, the user asked to proceed straight into the next phase
once the current one finishes cleanly, without pausing for a go-ahead each time.

## ADR-003: Entity-resolution candidates restricted to same district, not just same type

**Date:** 2026-09-05

**Context:** The first full entity-resolution run (candidates = same `project_type`
only, weights leaning on `text_similarity`) produced 9,962 POSSIBLE_MATCH pairs out of
64,349 evaluated — effectively flagging most same-type projects as possible duplicates.
Root cause, found by inspecting the lowest-confidence flagged pairs: the synthetic
project names follow a rigid `"{type phrase} – {locality}"` template, so any two
same-type projects embed as near-identical text (cosine ~0.95+) regardless of whether
they're actually the same entity — `text_similarity` (weight 0.30) plus the always-1.0
`type_similarity` (candidates are type-filtered) alone got most pairs past the 0.55
threshold.

**Decision:** Restrict candidate retrieval to same `project_type` **and** same
`state`/`district` (a duplicate MPLADS sanction is, definitionally, the same work
reported twice in the same local area — this loses no recall against the planted
ground truth, whose duplicate pairs are always same-district by construction). Rebalance
`FEATURE_WEIGHTS` to lean on `date_similarity` and `amount_similarity` (0.20 each) —
the features that actually discriminate a real duplicate from two unrelated same-type
projects in the same district, since text/location/type are now near-constant across
the candidate pool and can't discriminate anymore. Raised `POSSIBLE_MATCH_THRESHOLD`
to 0.65 and `MATCH_THRESHOLD` to 0.85 accordingly.

**Consequence:** A genuine duplicate reported in a different district than its
original would not be found by this pipeline. Acceptable for MPLADS (district-scoped
sanctions); would need revisiting if applied to a dataset where cross-district
duplicates are expected.

## ADR-004: P03 measures overrun against a project's own deadline, not elapsed time vs. peer median

**Date:** 2026-09-05

**Context:** The first version of P03 (delay anomaly) compared a still-running project's
raw elapsed time against the peer group's median *planned* duration. This flagged 52%
of all 9,901 projects — not because half the portfolio is actually delayed, but because
the comparison is statistically biased: at any snapshot in time, projects that finish
faster than the median have already left the "still running" pool and become COMPLETED,
so the ongoing/delayed pool is a survivorship-biased sample skewed toward slower
projects. Comparing elapsed-time-so-far against a peer median this way trends toward
flagging roughly half of everything regardless of whether any individual project is
actually behind schedule.

**Decision:** Measure overrun against each project's *own* `expected_completion_date`
instead (`overrun_days = today - expected_completion_date` for still-running projects,
or `actual_completion_date - expected_completion_date` for completed ones). Only flag
when `overrun_days <= 0` is false (i.e. the project has actually missed its own
committed deadline) and the overrun is large relative to the peer-group's typical whole
duration. This is self-referential per project and immune to the survivorship bias —
an ONGOING project still inside its own committed window is correctly never flagged,
regardless of how it compares to peers.

**Consequence:** After this fix (and a related fix to the synthetic generator's
COMPLETED/DELAYED split, which was set to make 45% of past-due projects DELAYED —
unrealistically high and part of what made the original bug hard to distinguish from
noise), DELAY_ANOMALY fires on ~20% of projects, and recovers 100/100 planted
delay-anomaly cases.

## ADR-005: P05 uses a z-test against baseline, not a flat percentage threshold

**Date:** 2026-09-05

**Context:** The first version of P05 (contractor pattern) flagged any contractor with
≥5 projects and a delayed-or-high-risk rate above a flat 40%/30% cutoff. This flagged
81 of 438 eligible contractors (930 projects) — inspecting the flagged contractors
showed most had exactly 5-10 total projects and 2-4 delayed, which is well within
ordinary binomial variance at the ~20% population baseline delay rate (a contractor
with 5 projects has roughly a 1-in-4 chance of showing "40% delayed" from chance alone).
A flat percentage threshold can't tell a demonstrated pattern from small-sample noise.

**Decision:** Replace the flat threshold with a z-test: for each contractor, compute
the z-score of their observed delayed/high-risk count against the population baseline
rate for that sample size (`z = (observed - n*baseline_rate) / sqrt(n*baseline_rate*(1-baseline_rate))`),
and flag only when z ≥ 2.0 (roughly one-sided p < 0.025). This naturally requires a
much larger relative deviation from a small sample and tolerates a smaller one from a
well-evidenced large one — exactly the property a flat cutoff lacks. Also raised
`MIN_PROJECTS` from 5 to 8.

**Consequence:** CONTRACTOR_RISK_PATTERN dropped from 930 to 345 projects (81 → fewer,
statistically-justified contractors), and recall against the 50 planted contractor-
pattern cases is 80% (39/49 loaded) — lower than a flat threshold would show, but that
lower number is trustworthy where the flat-threshold number wasn't.

## ADR-006: Isolation Forest recall varies sharply by how many features an anomaly touches — not tuned to close the gap

**Date:** 2026-09-05

**Context:** Phase 5's Isolation Forest (12 peer-normalized features, 5% contamination)
scored 33.1% precision / 40.7% recall / F1 0.365 overall against the numeric-detectable
planted ground truth (403 cases). The per-category breakdown is uneven in an informative
way: PAYMENT_PROGRESS_MISMATCH 100% (98/98), CONTRACTOR_RISK_PATTERN 59% (29/49),
DELAY_ANOMALY 29% (29/100), GEOGRAPHIC_CONCENTRATION 7% (2/30), EVIDENCE_ANOMALY 3%
(1/30), and — most strikingly — COST_ANOMALY only 6% (6/100), despite `cost_ratio`
being one of the 12 input features and planted cost anomalies being 1.8–3.5x the peer
median (P02's rule-based detector, by contrast, catches 96/100 of these).

The reason is structural, not a bug: `plant_cost_anomalies` in the synthetic generator
only mutates the amount fields, leaving all 11 other features exactly as generated —
so a planted cost anomaly is extreme on exactly 1 of 12 dimensions and unremarkable on
the rest. Isolation Forest isolates points via random splits across the *whole* feature
set jointly; a point unusual on only one axis needs more splits to separate from the
crowd than one that's simultaneously unusual across several — which is exactly why
PAYMENT_PROGRESS_MISMATCH (touches `progress_gap` *and* `funding_utilization_gap`
together) and CONTRACTOR_RISK_PATTERN (touches both contractor-rate features together)
score so much higher. This is documented Isolation Forest behavior, not misconfiguration.

**Decision:** Leave it as-is rather than reshaping the feature set or reweighting to
close the gap. Doing that would mean tuning the "unsupervised" model against the very
labels it's being evaluated on — which a real deployment wouldn't have — and would
invalidate the evaluation. `CONTAMINATION=0.05` was likewise chosen from the ballpark of
what an analyst would guess as a plausible base anomaly rate (it happens to sit close to
the true 403/9,901 ≈ 4.1%), not fit to the labels.

**Consequence:** This is a genuine argument for Phase 6's design, not a weakness to hide:
ML is deliberately complementary to the rules, not a replacement — it's strong exactly
where the rules are structurally blind (correlated multi-feature drift a human wouldn't
think to write a rule for) and weak exactly where a single-feature rule (P02) already
does the job better. The risk engine should weight both sources rather than picking one.

## ADR-007: Risk-score aggregation exposed a hidden saturation bug in P01–P03's scoring

**Date:** 2026-09-05

**Context:** Phase 6 combines every project's RiskSignal rows via a noisy-OR
(`1 - product(1 - contribution_i)`, see `app/risk/scoring.py`), where one signal's
contribution can reach 1.0 and single-handedly force the aggregate to exactly 100
(CRITICAL). The first run produced 2,163/9,901 projects (22%) at CRITICAL — implausibly
high for a triage signal meant to prioritize limited investigator attention. Inspecting
the CRITICAL cohort: 75% were driven by a single saturated (~1.0 contribution) signal,
and 67% of *all* DELAY_ANOMALY signals (not just the planted ones) scored exactly 100.

The root cause was in P03, not the aggregation: its score formula
(`min(100, ratio * 60)`) is a hard linear cap, and `ratio` (overrun vs. peer median
duration) is unbounded for an organically-generated DELAYED project with an old
start_date that was simply never marked complete — the synthetic generator doesn't
cap how "stale" such a project's overrun-against-today can get, so a huge fraction
of organic (non-planted) delays land past the ratio≈1.67 saturation point and become
numerically indistinguishable from a mildly-late project at that same cap. P01 and P02
had the same hard-cap pattern and were more mildly affected.

**Decision:** Replace the hard linear cap in P01, P02, and P03 with a saturating
transform (`saturating_score` in `app/risk/rules/base.py`):
`score = 100 * x / (x + midpoint)`. This climbs quickly for meaningfully bad cases but
only approaches 100 in the limit, never reaching it exactly for any finite input — so
an arbitrarily extreme organic delay no longer becomes bit-identical to a merely
severe one, and no single rule signal can mechanically force the aggregate to its own
maximum on formula-saturation alone. Detection thresholds (which projects get flagged
at all) were untouched — only the numeric score magnitude changed — so Phase 4's
recall-against-ground-truth counts are unaffected.

**Consequence:** CRITICAL dropped from 2,163 (22%) to 1,325 (13.4%); the fraction driven
by a single near-saturated signal dropped from 75% to 14%, and 63% of CRITICAL projects
now have more than one contributing signal — the aggregate is doing what it was designed
to do (reward genuine corroboration) rather than being short-circuited by one rule's
formula quirk. This was caught by inspecting the *score distribution* directly (67% of
all DELAY_ANOMALY signals at exactly 100), not by tuning against planted labels.

## ADR-008: No graph database — relationship queries live in Postgres/PostGIS

**Date:** 2026-09-05

**Context:** Spec §12 calls for "graph intelligence" (related projects, contractor
networks, geographic proximity). The stack chosen in Phase 1 is Postgres+PostGIS, not a
dedicated graph database (Neo4j etc.) — introducing one now would mean syncing a second
store from the same source data for a dataset (9,901 projects, 500 contractors) that
Postgres joins and a PostGIS `ST_DWithin` handle natively and fast.

**Decision:** Implement relationship queries as SQL in `app/graph/relationships.py`:
`find_related_projects` combines four independent relationship types (same contractor,
same implementing agency, an entity-resolution match from Phase 3, geographic proximity
within 5km + same type) and tags each result with *which* relationships connect it, so
the API surfaces explainable connections rather than an opaque "related" list.
`get_contractor_network` surfaces other contractors repeatedly operating in the same
district+type niches as a given one — explicitly documented as a proxy for a real
corporate-registry network (shared directors, registered addresses), which this dataset
doesn't have, rather than dressing up a weaker signal as something it isn't.

While building `find_nearby_projects`, a real bug surfaced: passing a loaded project's
`geom` (a GeoAlchemy2 `WKBElement`) directly into a `cast(project.geom, Geography)` bind
parameter raised `parse error - invalid geometry` — the query built `ST_GeogFromText(...)`
expecting WKT, but a `WKBElement` serializes to EWKB hex, which isn't valid WKT syntax.
Fixed by referencing the project's geometry via a scalar subquery
(`select(cast(Project.geom, Geography)).where(Project.id == project.id).scalar_subquery()`)
so Postgres reads it directly from the row instead of it being bound as a Python value.

**Consequence:** No new infrastructure to run or keep in sync; relationship queries are
plain transactional reads, consistent with everything else in the system. Revisit only if
relationship traversal depth becomes a real requirement (e.g. "contractors of contractors
of contractors") that SQL joins would make awkward — not needed at this scale or for
these specific relationship types.

## ADR-009: RBAC on write/trigger endpoints only, not on read endpoints

**Date:** 2026-09-05

**Context:** Phase 8 adds JWT auth (`app/core/security.py`, `app/core/deps.py`) backed
by the `User` table from Phase 2. The login page (built ahead of schedule in Phase 3)
already frames the platform as having a public transparency portal alongside
authenticated official access.

**Decision:** Require authentication + role (`ADMIN` or `ANALYST`) only on endpoints that
mutate system-wide state: `POST /api/ingestion/upload`, `POST /api/entity-resolution/run`,
`POST /api/risk-signals/run`, `POST /api/ml/run`, `POST /api/risk-scores/run`. Every GET
endpoint (`projects`, `contractors`, `patterns`, `map`, `graph`, `risk-scores`) stays open.
Each protected action logs to `AuditLog` (spec's audit trail requirement) with the acting
user and a short metadata summary. Demo users for all four roles are seeded via
`scripts/seed_users.py` (`admin@mplads.gov.in` / `MpladsDemo123!`, etc.) since there's no
user-management UI yet.

**Consequence:** The frontend's dashboard pages can keep reading data without any auth
wiring (already true since Phase 3/6/9's real-data pages), while the actions that could
meaningfully disrupt the system (re-running detection across the whole portfolio,
uploading new data) are gated. The frontend's login form still doesn't call this endpoint
yet — that lands when Phase 9 builds out the real dashboard pages that need it.

Building the Projects API also surfaced a real bug: `Project.implementing_agency_id` had
no corresponding `implementing_agency` relationship defined on the model (only
`contractor` was ever wired up), so `GET /api/projects/{id}` crashed with
`AttributeError: 'Project' object has no attribute 'implementing_agency'` the first time
anything tried to read it. Fixed by adding the missing relationship — no migration needed,
it's ORM-only.

Live testing this endpoint also surfaced an unrelated, pre-existing synthetic-data quirk:
`plant_geo_clusters` (Phase 2's generator) reassigns a project's `project_type` when
pulling it into a cluster but never regenerated `project_name` to match, so a handful of
records (~9 of 9,901) show a name describing their *original* type/locality. Fixed in the
generator for future runs; not worth a full ~20-minute re-ingest + re-resolve + re-score
cycle on the currently-loaded data for a cosmetic mismatch affecting 0.09% of records.

## ADR-010: maplibre-gl v6 has no default export

**Date:** 2026-09-05

**Context:** The Geographic Analysis map (Phase 9) imported `maplibregl` as a default
export (`import maplibregl from "maplibre-gl"`), which is how essentially every MapLibre
tutorial and the library's own older versions work. The production build failed:
`Export default doesn't exist in target module`. Inspecting the installed v6 bundle
(`node_modules/maplibre-gl/dist/maplibre-gl.mjs`) confirmed it only ships named exports
(`Map`, `NavigationControl`, `Popup`, `Marker`, etc.) — no default export at all.

**Decision:** Import what's needed by name: `import { Map as MapLibreMap,
NavigationControl, Popup } from "maplibre-gl"`.

**Consequence:** A reminder that `frontend/AGENTS.md`'s "this is not the Next.js you know"
warning generalizes to the dependency tree, not just Next.js itself — a library major
version can change its export shape in ways that look identical in every code example
still circulating. Caught by actually running `npm run build`, not by the code looking
plausible.

## ADR-011: MapLibre GL's worker never loaded under Turbopack — map was silently blank

**Date:** 2026-09-05

**Context:** Despite building cleanly and passing every automated check, the Geographical
Analysis map rendered as an empty colored rectangle in a real browser — no country
outlines, no project markers, controls present but nothing else. This was never
caught by `npm run build`/`npm run lint`/the earlier live verification, because all of
those check that the page *responds*, not that a WebGL canvas actually painted anything
— exactly the gap the `run` skill's "a blank frame is a failure to launch" guidance is
about. Found only by actually opening the page (via a headless-then-headed Playwright
Chromium, since no interactive browser is available in this environment) and screenshotting it.

Debugging in order: confirmed the data fetch worked (page text showed the right count);
confirmed `style.json`, its referenced `tiles/tiles.json`, and an actual `.pbf` tile all
fetch fine standalone (curl and in-browser); confirmed MapLibre's `load`/`idle` events
never fired despite `styledata` firing twice; then found via `page.on('worker', ...)`
that the Worker MapLibre creates for off-main-thread tile parsing was being constructed
with the **current page's own URL** instead of its worker script — it closed
immediately, silently, with no console error, page error, or failed network request.

Root cause: MapLibre GL v6's worker is loaded via an `import.meta.url`-relative path
that Turbopack does not resolve to the correct built asset — the same general class of
"bundler doesn't yet handle this pattern" issue as ADR-010, but for a Worker (silent
failure) rather than an import (build-time failure), which is why it went undetected by
every automated check.

**Decision:** Bypass the bundler for the worker script entirely: copy
`maplibre-gl-worker.mjs` and its sibling chunk `maplibre-gl-shared.mjs` (the worker
bundle's own relative import — copying only the worker file reproduces the identical
silent-failure symptom, since the worker then 404s on that import) from
`node_modules/maplibre-gl/dist/` into `frontend/public/`, and call
`setWorkerUrl("/maplibre-gl-worker.mjs")` (a real exported API from the `maplibre-gl`
package) before constructing any `Map` instance.

**Consequence:** These two files must be re-copied if `maplibre-gl` is upgraded (they're
version-matched to whatever's in `node_modules`). Verified fixed with a real screenshot
(country borders visible, all 5,000 project markers rendering in their risk-band
colors), in both headless and headed Chromium, and under both `reactStrictMode: true`
(the project default) and `false` — this was never a React double-mount issue, despite
that being the first, wrong hypothesis.

## ADR-012: Added Groq as a third LLM provider, reusing the OpenAI-compatible code path

**Date:** 2026-09-05

**Context:** The user provided a real Groq API key and asked to use Groq for the AI
Assistant. Groq's chat completions API is wire-compatible with OpenAI's (same request/
response JSON shape, same `Authorization: Bearer` auth), so it didn't need a new request/
response handler — only a new base URL. `_call_openai` in `app/services/llm.py` was
generalized to `_call_openai_compatible(url, ...)`, and both `"openai"` and `"groq"`
providers now call it with their respective endpoints.

The first live test failed: `404 model_not_found` for `llama-3.3-70b-versatile`, a
model that no longer exists on this account's Groq deployment (their available lineup
turns over quickly). Fixed by querying `GET https://api.groq.com/openai/v1/models` with
the actual key rather than trusting a remembered model name, and picking
`openai/gpt-oss-120b` from what was genuinely listed as available.

**Decision:** `LLM_PROVIDER=groq` + `LLM_API_KEY` (in `backend/.env`, gitignored) +
`LLM_MODEL=openai/gpt-oss-120b`. `.env.example` now tells the next person to check the
live `/v1/models` endpoint rather than copying a model name from an example or from an
LLM's own training data — both go stale.

**Consequence:** Verified live with real questions (a specific CRITICAL project's risk
explanation, and a portfolio-wide summary) — both answers were accurate, grounded only
in the retrieved context, and correctly cited the specific numbers (₹915,533, 15.7x,
616 days, exact risk-band counts) rather than paraphrasing loosely. The AI Assistant is
now genuinely live, not just plumbed-but-inert as it was at the end of Phase 10.

## ADR-013: A narrative explanation layer on top of the existing signal data — not a new detector

**Date:** 2026-09-05

**Context:** External demo feedback (from a technical reviewer) recommended framing the
platform explicitly as "multi-signal" (financial/execution/spatial signals combined,
never "AI detects anomalies") and building a judge-facing "✨ Explain Risk" feature: a
numbered list of concrete reasons, a confidence percentage, and a "recommended
verification" action — all from a single high-risk project. The system already *had*
every piece of this (Phase 4's rules are literally organized as financial/execution/
spatial signal families, Phase 6's risk engine already combines them transparently, and
`GET /api/risk-scores/{id}/explain` already returned every contributing signal) — what
was missing was presentation: raw signal descriptions and metadata, not a short
plain-English narrative a judge could read in five seconds.

**Decision:** Added `app/risk/narrative.py` — a pure formatting layer, not a new
detector. `narrate_signal()` pattern-matches on `signal_type` and renders one line per
signal using only fields already present in that signal's own `evidence` dict (no new
computation, no new data source); `RECOMMENDED_VERIFICATION` is a static per-signal-type
lookup of a suggested next step; `build_explanation()` combines both plus a
contribution-weighted overall confidence. Wired into the existing `/explain` endpoint
(`narrative_reasons`, `recommended_verification`, `overall_confidence` added to the
response, nothing removed) and into the Project Detail page as the primary "✨ Why
investigate this project?" panel, with the original per-signal technical detail kept
as a collapsed `<details>` section underneath rather than deleted — analysts who want
the raw signal metadata still get it.

While wiring this into the API endpoint, sorting `contributing` (the existing response
list) in place and then `zip`-ing it against the original unsorted `signals` list would
have silently paired each `RiskSignal` with the *wrong* `ContributingSignal` — caught
before it shipped by deriving both lists from one single sorted `ranked_signals`
sequence instead of sorting one of two parallel lists independently.

Also updated the login hero panel's copy ("AI-powered anomaly & risk detection" →
"Financial, execution & spatial signals combined"; "AI-Powered Public Fund Monitoring"
→ "Multi-Signal Public Fund Monitoring") — the Overview, Risk & Alerts, and Pattern
Intelligence pages already described the system in rules/ML/correlated terms and didn't
need changing.

**Consequence:** No detection logic changed — recall/precision numbers from Phases 4-6
are unaffected. Verified live end-to-end with a screenshot: real numbered reasons citing
exact figures (₹915,533, 15.8x, 616 days), a real 97% confidence figure, and real
recommended-verification actions, all traced to already-computed signal evidence.

## ADR-014: A naive baseline matches or beats Isolation Forest — kept it anyway, for a specific reason

**Date:** 2026-09-05

**Context:** `ml/experiments/baseline_vs_isolation_forest.py` was built to answer an
honest question the project hadn't actually tested: does the Isolation Forest model
(Phase 5) earn its complexity over the simplest possible alternative — flagging
whichever projects have the single most extreme feature value (max absolute z-score
across the same 12 engineered features), at the identical 5% flagging rate?

**Result: no.** The baseline scored **higher** overall (F1 0.401 vs 0.367; precision
36.4% vs 33.3%; recall 44.7% vs 40.9%) and clearly beat Isolation Forest on
`COST_ANOMALY` (24% vs 5% recall) and `GEOGRAPHIC_CONCENTRATION` (13% vs 7%). Isolation
Forest only came out ahead on `DELAY_ANOMALY` (32% vs 23%); both were identical on
`PAYMENT_PROGRESS_MISMATCH` (100%) and `EVIDENCE_ANOMALY` (3%).

**Decision:** Keep Isolation Forest in the pipeline, but stop describing it (even
internally) as "the model that finds anomalies" — the actual evidence says a one-line
statistical rule does that job at least as well, for every category tested. The honest
case for keeping it is narrower and specific: it is the only detector in the system
whose isolation mechanism can in principle respond to a *correlated drift across
several features at once* that nobody anticipated enough to write a rule for — a shape
of anomaly a single-feature baseline (or a hand-written rule) cannot catch by
construction. That's a real, different capability, not a performance edge — and this
experiment doesn't contain an example of it actually happening in the current planted
categories, which is itself worth stating plainly rather than implying otherwise.

**Consequence:** `ml/README.md` and the experiment's own report state this result
undecorated, including the exact numbers. Combined with ADR-006 (Isolation Forest is
also weaker than domain rules for single-dimension anomalies) and this result (weaker
than even a naive baseline, overall), the honest position is: rules trained on domain
knowledge (peer groups, statistical significance tests) are doing the real detection
work in this system; Isolation Forest is a hedge against unknown-unknowns, not a
performance win, and the system's design and its own documentation should say so.

## ADR-015: Delhi was missing from the synthetic dataset entirely

**Date:** 2026-09-05

**Context:** The user noticed the Geographical Analysis map showed zero projects in
Delhi and correctly flagged this as implausible — MPLADS covers every MP, and Delhi
(NCT) has 7 Lok Sabha + 3 Rajya Sabha seats. Checking `app/utils/reference_data.py`
confirmed it: the synthetic generator's `STATES` dict had exactly 15 states, and Delhi
was never one of them — not a map rendering bug, a real gap in the data the map was
faithfully displaying.

**Decision:** Added Delhi to `STATES` (7 districts, center `(28.6139, 77.2090)`, a much
smaller `spread` than the other entries since NCT of Delhi is geographically compact
compared to a full state) and to `STATE_CODES`. Regenerated the full synthetic dataset
and reran the complete pipeline (ingestion → entity resolution → rules → ML → risk
scoring) rather than patching Delhi in on top of the old dataset, since project IDs,
peer-group statistics, and contractor assignments are all computed together — a partial
patch would have left Delhi's peer-group comparisons inconsistent with everywhere else.

**Consequence:** This wiped the database's other transient state along with it (the
demo investigation and seeded users created earlier in this session) — expected and
disclosed, not a surprise, since regenerating source data necessarily resets everything
computed downstream of it. Also added `GET /api/map/filters` and state/risk-band/
project-type dropdowns to the Geographic Analysis page while already touching this area,
since "why can't I filter the map" was the user's other ask in the same message.
