# PROGRESS.md

Backend build progress for PhysicalData Network.

**Status legend:** Done · Partial · Not started

Last audited: 2026-10-11 (Phase 8 complete). Verified with `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

---

## Authoritative phase list

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold: project, config, lint, test setup, env validation, error envelope, health route | **Done** |
| 1 | Migrations for all tables + seed script | **Done** |
| 2 | Auth, roles, DEV auth mode, `GET /api/me` | **Done** |
| 3 | Jobs and tasks: create, publish, list, get, claim with atomic lease and idempotency | **Done** |
| 4 | Draft and submit with validation, append-only submissions, gold scoring, state machine | **Done** |
| 5 | Review queue, decision endpoint, MockAiReviewer, routing | **Done** |
| 6 | Settlement (mock), receipts, earnings | **Done** |
| 7 | Export and manifest | **Done** |
| 8 | Appeals (last, only if time remains) | **Done** |

---

## Phase detail

### Phase 0 — Scaffold: **Done**
- Next.js 16 App Router API project (`package.json`, `tsconfig.json`, `next.config.ts`).
- Test setup: Vitest (`vitest.config.ts`); `npm test` passes (21 tests).
- TypeScript: `npm run typecheck` passes.
- Lint: fixed in this step — `eslint.config.mjs` now uses the Next 16 flat config
  (`eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`); `npm run lint` passes.
- Env validation: `lib/env.ts` (zod, production guards).
- Error envelope: `lib/api/response.ts`; CORS: `lib/api/cors.ts`.
- Health route: `app/api/health/route.ts` (`GET /api/health`).
- DB client: `lib/db/supabase.ts` (service-role singleton).

### Phase 1 — Migrations + seed: **Done**
- `supabase/migrations/001_initial_schema.sql` (all tables/enums/indexes/RLS),
  `002_updated_at_triggers.sql`, `003_seed_schema_versions.sql`.
- `src/types/api.ts`, `lib/tasks/stateMachine.ts` (+ tests).
- `scripts/seed.ts` fixed: seed rows now use deterministic, valid UUIDs
  (`5eed0000-0000-4000-8000-0000000000NN`, centralised in `SEED_IDS`) instead of the
  non-UUID `seed-*` ids that Postgres rejected. `requests.http` and `backend/README.md`
  updated to the new ids. Script loads via `tsx` and stops at the credentials guard when
  `.env.local` is absent (a live Supabase run still needs credentials).

### Phase 2 — Auth, roles, DEV mode, `/api/me`: **Done**
- `lib/auth/errors.ts` — `AuthError` (401/403) mapped by `withErrorHandler`.
- `lib/auth/verifyToken.ts` — `resolveUser`; DEV mode via `x-dev-user-id` (validated UUID,
  user must exist); provisioning by Privy DID ready for when verification lands.
- `lib/auth/requireRole.ts` — `requireUser`, `requireRole(req, ...roles)`.
- `app/api/me/route.ts` — `GET /api/me` with CORS + contributor-profile summary.
- Types: `MeProfile`, `CurrentUser` added to `src/types/api.ts`.
- Tests: `lib/auth/__tests__/auth.test.ts` (13 tests).
- **Privy note:** production token verification is still a stub (`verifyPrivyToken`) pending
  OQ1–OQ3 (SDK/claim shape unknown). DEV mode is fully functional.
- Correction to Phase 0: added missing `react`/`react-dom` (Next 16 peer deps) so
  `next build`/`next dev` run; build now succeeds.
- Smoke-tested with `next dev`: `/api/me` → 401 envelope without/invalid identity, `/api/health` → 200.

### Phase 3 — Jobs and tasks: **Done**
- Shared infra:
  - `lib/api/errors.ts` — `HttpError` (code + status + details) with static
    constructors; `AuthError` now extends it; `withErrorHandler` maps `HttpError`.
  - `lib/api/request.ts` — `readJson` (400 on malformed JSON).
  - `lib/api/pagination.ts` — `parsePagination` / `paginated` (default 20, cap 100).
  - `lib/hash.ts` — `canonicalize` (recursive key sort) + `hashCanonicalJson` (keccak256 via viem).
  - `lib/idempotency.ts` — `withIdempotency` (composite `${endpoint}:${userId}:${key}`,
    stored in `idempotency_keys`, replays stored response).
  - `lib/rateLimit.ts` — `consume` over `rate-limiter-flexible` memory buckets.
  - `lib/tasks/leases.ts` — `leaseExpiryFromNow`, `isLeaseExpired`, `releaseExpiredLeases`.
  - `lib/storage.ts` — `createSignedMediaUrl` (5-minute signed URLs, private bucket).
  - `lib/jobs/repository.ts`, `lib/tasks/repository.ts` — row mappers + ownership/`gold_answer` guards.
  - `lib/validation/jobs.ts` — zod schemas for job creation and list filters.
- Routes:
  - `POST /api/jobs` (buyer, draft) · `GET /api/jobs` (buyer own / admin all, paginated, filters).
  - `GET /api/jobs/{id}` (own/admin) · `POST /api/jobs/{id}/publish` (draft → published, 409 otherwise).
  - `GET /api/tasks/available` (contributor; releases expired leases; only published jobs; no `gold_answer`).
  - `GET /api/tasks/{id}` (lease owner / reviewer / admin; returns signed media URL).
  - `POST /api/tasks/{id}/claim` (atomic `UPDATE ... WHERE status='available'`, idempotent, rate-limited).
- Tests: +26 (hash 7, pagination 8, job validation 11); suite now 60 passing.
- Env: added `SUPABASE_STORAGE_BUCKET` (default `media`) to `lib/env.ts` and `.env.example`.

### Phase 4 — Draft and submit: **Done**
- Migration `supabase/migrations/004_task_drafts.sql` — `task_drafts`
  (`task_id` PK, `contributor_id`, `payload` JSONB, `updated_at` trigger, RLS on).
  Drafts are mutable scratch space; submissions stay append-only.
- Payload schemas `lib/validation/payloads.ts` — zod mirror of the seeded
  `image-boxes-v1` / `action-segments-v1` JSON Schemas, exposed as a
  `schema_version`-discriminated union (`annotationPayloadSchema`). Shape checks
  are lenient so in-progress drafts autosave.
- Semantic validation `lib/annotation/validate.ts` — `parseAnnotationPayload`
  (structural failures → 422 `SCHEMA_INVALID`) plus field-level `ReasonCode`
  issues (`BOX_NEGATIVE_SIZE`, `BOX_OUT_OF_BOUNDS`, `BOX_INVALID_CLASS`,
  `SEGMENT_OUT_OF_BOUNDS`, `SEGMENT_OVERLAP`, `SEGMENT_ORDER`,
  `SEGMENT_MISSING_FAILURE_REASON`) and task/asset identity cross-checks.
- Gold scoring `lib/tasks/goldScoring.ts` — `intersectionOverUnion`, greedy
  `scoreImageBoxes` (class match + IoU ≥ `GOLD_IOU_THRESHOLD`), and
  `scoreVideoSegments` (label match + endpoints within
  `GOLD_SEGMENT_MS_TOLERANCE`). A pass needs every gold item matched *and* equal
  cardinality (no extra items).
- Fast-submit flag `lib/tasks/fastSubmitGuard.ts` — derives claim time from
  `lease_expiry - LEASE_MINUTES`; flags submissions sooner than
  `FAST_SUBMIT_THRESHOLD_SECONDS` (default 30). A flag routes to human review,
  never automatic punishment.
- Submission flow `lib/tasks/submissions.ts` — authorization (live lease, or a
  prior submitter revising a `needs_revision` task), transition helpers
  (`draftTransitionPath` / `submitTransitionPath`), append-only insert with
  per-task `version` = max + 1, `DUPLICATE_PAYLOAD` detection on
  `payload_hash`, fast flag, gold auto-adjudication, and the resulting `code`
  `reviews` row.
- Routes:
  - `PUT /api/tasks/{id}/draft` — autosave (lease owner); `{ task_id, saved_at }`.
  - `POST /api/tasks/{id}/submit` — idempotent + rate-limited; `201 Submission`;
    422 (`VALIDATION_ERROR` with reason codes) / 409 / 429.
- Types: `DraftSaveResult`, `ClaimResult` (`src/types/api.ts`); `claim` route now
  imports the shared `ClaimResult`.
- Env: `FAST_SUBMIT_THRESHOLD_SECONDS` (default 30) in `lib/env.ts` + `.env.example`.
- Tests: +42 (payloads 11, semantic validation 13, gold scoring 12, fast-submit 6);
  suite now 102 passing.
- **Decision (documented):** gold tasks are auto-adjudicated — pass →
  `accepted` + `code`/`accept`/`ACCEPTED`; fail → `needs_revision` +
  `code`/`revise`/`GOLD_FAIL`. Non-gold submissions stay `submitted` for Phase 5
  review routing; the `code` review row is only persisted for gold outcomes.
- **Decision (documented):** submitting clears the task lease (`claimed`/`draft`
  → … → `submitted`); a `needs_revision` task remains revisable because
  authorization falls back to prior-submission ownership.

### Phase 5 — Review queue, decisions, MockAiReviewer, routing: **Done**
- Routing `lib/review/router.ts` — pure `routeSubmission` picks a lane for
  non-gold submissions: video always human; images go to the AI first pass
  unless a risk signal applies (fast-submit flag, first-time contributor
  `< 5` tasks, gold accuracy `< 80`).
- MockAiReviewer `lib/review/mockAiReviewer.ts` — deterministic stand-in for
  the Kimi first-pass image review (`AiReviewer` interface + `MockAiReviewer`).
  Returns `{ decision, reason_code, confidence, notes, rubric_version }`:
  empty boxes → `revise`/`MISSING_OBJECTS`; mostly low-confidence boxes →
  `revise`/`LOW_QUALITY`; otherwise `accept`/`ACCEPTED` (0.88).
- Review repository `lib/review/repository.ts` — `insertReview` (shared by the
  Phase 4 gold flow), `loadSubmission`, and `listSubmittedQueue` (submissions
  whose task is `submitted`, with public task projection + job, paginated).
- Service `lib/review/service.ts`:
  - `applyAutoRouting` (called at the end of non-gold submit) routes, records
    the `ai` suggestion, and auto-applies the decision when
    `confidence >= AI_CONFIDENCE_THRESHOLD`; otherwise the task stays
    `submitted` for the human queue.
  - `decideSubmission` guards (not the author, task must be `submitted`,
    `reason_code` consistent with `decision`), records a `human` review, and
    transitions `submitted → accepted | needs_revision | rejected`.
  - `listReviewQueue` (task status `submitted` is the single source of truth for
    "awaiting review" and the "already decided" conflict guard).
- Routes:
  - `GET /api/review/queue` (reviewer/admin; `modality`/`reviewer_type` query,
    paginated `ReviewQueueItem` = `Submission & { task, job }`).
  - `POST /api/reviews/{submissionId}/decision` (reviewer/admin; 200 `Review`;
    403 self-review; 404; 409 already decided; 422 reason/decision mismatch).
- Types: `ReviewQueueItem` (`src/types/api.ts`).
- Shared helpers: `toSubmission` + `updateTaskStatus` moved to
  `lib/tasks/repository.ts` so the submit and review flows share them (avoids a
  module cycle); `insertCodeReview` replaced by `insertReview`.
- Tests: +11 (routing 7, MockAiReviewer 4); suite now 113 passing.
- **Decision (documented):** a task is "awaiting review" iff `status =
  'submitted'`; AI/mock decisions that clear the confidence threshold move the
  task out of that state (so the human queue only holds unresolved work).
- **Known gap:** `GET /api/review/queue?reviewer_type=` is accepted for API
  compatibility but not used to filter (the submitted queue is the human lane);
  final per-lane filtering is deferred.

### Phase 6 — Settlement (mock), receipts, earnings: **Done**
- **Money helpers** `lib/settlement/money.ts` — fixed-point (scale 6) integer
  math so `NUMERIC(18,6)` rewards/budgets sum exactly; `sumDecimalStrings`
  and `withinBudget` back the earnings totals and the budget guard.
- **Repository** `lib/settlement/repository.ts` — receipt row mapping/insert,
  `loadReceiptRow` (404), `loadAcceptingReview` (latest `accept` for a
  submission, used for `review_ref`), `countPaidTasksInJob`, and
  `incrementTasksCompleted`.
- **Service** `lib/settlement/service.ts`:
  - `MockSettlementService` implements `SettlementService`; it returns a
    deterministic mock `tx_hash` (`hashCanonicalJson` of task/submission/amount)
    with `is_mock = true`.
  - `settleAcceptedTask` enforces the settlement invariants — task must be
    `accepted` (never already `paid`), submission must belong to the task, and
    the next payout must not exceed the funded `budget` — then records the
    receipt, transitions `accepted -> paid`, and increments `tasks_completed`.
  - `getPublicReceipt` joins submission→task and review→reviewer_type, and
    returns only the public fields (no auth).
  - `getEarningsSummary` dedupes the contributor's submissions by task (highest
    version), returns `total_accepted` (count of accepted + paid),
    `total_paid`, `total_pending`, and the per-task list with `tx_hash`.
- **Routes:** `POST /api/settlement/accept` (admin, idempotent),
  `GET /api/receipts/{id}` (public), `GET /api/earnings` (contributor).
- **Types/validation:** `PublicReceipt` in `src/types/api.ts`;
  `settlementAcceptSchema` in `lib/validation/settlement.ts`.
- Tests: +8 (money 6, mock settlement 2); suite 124 passing.
- **Decision (documented):** on-chain settlement is stubbed — when
  `JOB_ESCROW_ADDRESS` + `MONAD_RPC_URL` are absent the mock path is always used
  (`is_mock = true`); wiring the real signer is deferred (OQ1–OQ3).

### Phase 7 — Export + manifest: **Done**
- **Exporter** `lib/export/exporter.ts`:
  - `buildManifest` produces the provenance manifest (dataset id, schema
    version, per-asset hashes, rights reference, review-policy version, export
    time, record counts).
  - `buildCoco` emits COCO-style JSON for image jobs (`images`, `annotations`,
    `categories`, `info`); unseen box classes are appended to the categories.
  - `buildJsonl` emits a `manifest` line then one `record` line per submission
    (nested payloads preserved).
  - `buildCsv` emits a manifest row then flat box/segment rows with a shared
    column set; values are RFC-4180 escaped.
  - `serializeExport` selects the body + content type per format
    (`application/json`, `application/x-ndjson`, `text/csv`).
- **Repository** `lib/export/repository.ts` — loads only `accepted`/`paid` tasks
  for the job, joins assets (hash + dimensions), picks the highest-version
  submission per task, resolves `reviewer_type` from the accepting review, and
  resolves `tx_hash` from receipts. Never loads contributor identity.
- **Route** `GET /api/jobs/{id}/export` (buyer own-jobs / admin) with
  `format=json|jsonl|csv` (invalid → 422), returns a file download
  (`Content-Disposition: attachment`) with CORS.
- **Types/validation:** `ExportManifest` in `src/types/api.ts`;
  `exportFormatSchema` in `lib/validation/export.ts`.
- Tests: +9 (exporter); suite 133 passing.
- **Decision (documented):** there is a single export endpoint; the manifest is
  bundled in the downloaded file (COCO `manifest`/`info` for json, first line for
  jsonl, first row for csv) rather than exposed as a separate route.

### Phase 8 — Appeals: **Done**
- **Workflow** `lib/appeals/service.ts`:
  - `submitAppeal` — a contributor appeals their own `rejected` submission
    (403 if not the owner, 409 if the task is not `rejected` or an appeal
    already exists); records an `open` appeal and transitions
    `rejected -> appealed`.
  - `decideAppeal` — reviewer/admin adjudicates an `open` appeal
    (403 self-review, 409 if already resolved or the task is not `appealed`);
    requires a reason/decision match (`accept`↔`APPEAL_UPHELD`,
    `reject`↔`APPEAL_DISMISSED`, else 422); records a human review, resolves the
    appeal, and transitions `appealed -> accepted | rejected`.
  - `appealDecisionToStatus` / `appealDecisionToAppealStatus` /
    `assertAppealReasonMatch` are pure and unit-tested.
- **Repository** `lib/appeals/repository.ts` — appeal row mapping, insert,
  `loadAppeal`, `findAppealForSubmission`, `resolveAppeal`, and
  `listOpenAppeals` (open appeals with public task projection + job, paginated).
- **Routes:**
  - `POST /api/submissions/{id}/appeal` (contributor; idempotent; 201 `Appeal`).
  - `GET /api/review/appeals/queue` (reviewer/admin; paginated
    `AppealQueueItem` = `Appeal & { submission, task, job }`).
  - `POST /api/appeals/{id}/decision` (reviewer/admin; 200 resolved `Appeal`).
- **Migration** `005_appeals_indexes.sql` (`idx_appeals_submission_id`,
  `idx_appeals_status`).
- **Types/validation:** `AppealQueueItem` in `src/types/api.ts`;
  `appealRequestSchema`/`appealDecisionSchema` in `lib/validation/appeals.ts`.
- Tests: +4 (appeals helpers); suite 137 passing.
- **Decision (documented):** `POST /api/submissions/{id}/appeal` is the only
  appeal endpoint in the original API contract. The queue and decision routes
  are **inferred extensions** required to make the `appealed` state realisable
  (the state machine allows `appealed -> accepted | rejected`, and PRD §5/§8.3
  assign appeal handling to reviewers); they are now documented in `docs/API.md`.
- **Decision (documented):** upholding an appeal records a human `accept` review
  with `APPEAL_UPHELD`, so a later settlement/export resolves `reviewer_type` to
  `human`; a dismissed appeal leaves the task `rejected` (never payable).

---

## Known issues

1. `docs/BACKEND_SPEC.md` and `docs/AGENTS.md` are empty.
2. `docs/API.md` and `backend/README.md` describe endpoints/modules not built yet (doc drift); all documented endpoints (Phases 0–8) now exist.
3. `app/route.ts` and `app/[slug]/route.ts` are leftover scaffold "Hello world" routes, unrelated to the API.
4. `GET /api/review/appeals/queue` and `POST /api/appeals/{id}/decision` are inferred extensions (see Phase 8); the original API contract only defined the appeal submission endpoint.
5. Privy production auth is not wired up (`verifyPrivyToken` throws); blocked on OQ1–OQ3.
6. `releaseExpiredLeases` only sweeps `claimed`/`draft`; `needs_revision` has no lease (Phase 4 authorization falls back to prior-submission ownership). `task_drafts` rows are not swept on lease expiry (they are cleared on submit).

---

## Change log

- 2026-10-11: Phase 0 — replaced broken `eslint.config.mjs` with Next 16 TypeScript flat config;
  removed unused import in `app/api/health/route.ts`. `npm run lint`, `typecheck`, `test` all pass.
- 2026-10-11: Phase 1 — fixed `scripts/seed.ts` (valid deterministic UUIDs via `SEED_IDS`);
  updated seed ids in `requests.http` and `backend/README.md`.
- 2026-10-11: Phase 2 — added `lib/auth/*`, `app/api/me/route.ts`, auth tests, and type
  additions; mapped `AuthError` in the response envelope. Added missing `react`/`react-dom`
  (Phase 0 correction). `typecheck`, `lint`, `test` (34), `build` all pass.
- 2026-10-11: Phase 3 — added `lib/api/errors.ts` (`HttpError`, now extended by `AuthError`),
  request/pagination/hash/idempotency/rate-limit/lease/storage helpers, job & task repositories
  and validation, six job/task routes (create/list/get/publish, available/get/claim), and 26
  tests. `typecheck`, `lint`, `test` (60), `build` all pass.
- 2026-10-11: Phase 4 — added migration `004_task_drafts`, payload schemas,
  semantic validation, gold scoring, fast-submit guard, the submission flow, the
  draft/submit routes, and 42 tests. `typecheck`, `lint`, `test` (102), `build` all pass.
- 2026-10-11: Phase 5 — added review routing, MockAiReviewer, review
  repository/service, the review queue and decision routes, wired non-gold
  auto-routing into submit, moved `toSubmission`/`updateTaskStatus` into the task
  repository, and 11 tests. `typecheck`, `lint`, `test` (113), `build` all pass.
- 2026-10-11: Phase 6 — added mock settlement service, fixed-point money
  helpers, receipt/public receipt mapping, settlement acceptance flow, earnings
  summary, the three settlement routes, and 8 tests. `typecheck`, `lint`,
  `test` (124), `build` all pass.
- 2026-10-11: Phase 7 — added export serialisers (COCO/jsonl/csv) with a
  provenance manifest, the accepted-records export repository, the
  `GET /api/jobs/[id]/export` route, and 9 tests. `typecheck`, `lint`,
  `test` (133), `build` all pass.
- 2026-10-11: Phase 8 — added the appeals repository/service, the appeal
  submission + appeals queue + appeal decision routes, migration
  `005_appeals_indexes`, and 4 tests. `typecheck`, `lint`, `test` (137),
  `build` all pass. All build phases (0–8) are complete.
