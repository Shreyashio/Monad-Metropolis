# ASSUMPTIONS.md

Things added by the backend that are not explicitly stated in the PRD.
Each item has a one-line reason.

---

## Task / Lease

| # | Assumption | Reason |
|---|---|---|
| A1 | Default lease duration is **30 minutes** (env `LEASE_MINUTES=30`) | PRD says "a limited time" without specifying; 30 min is a reasonable data-labelling session length. |
| A2 | Task status `"claimed"` exists between `"available"` and `"draft"` | Needed to represent the atomic moment between lease grant and first autosave. |
| A3 | A lease can be returned to `"available"` by the contributor (explicit abandon) as well as by expiry | PRD implies expiry release; explicit abandon reduces dead tasks. |

---

## Auth / Users

| # | Assumption | Reason |
|---|---|---|
| A4 | A new user row is created on first valid login with role `"contributor"` by default | PRD §4 says contributors qualify and claim; buyer and reviewer roles must be assigned by admin. |
| A5 | `DEV_AUTH_BYPASS` reads the user from the `x-dev-user-id` header (UUID) which must match an existing row in `users` | Simplest approach that lets the frontend work without Privy; avoids auto-creating ghost users in dev. |
| A6 | `privy_did` is nullable so DEV bypass users can exist without a Privy DID | Needed for seed users in dev. |

---

## Review reason codes

| # | Assumption | Reason |
|---|---|---|
| A7 | Proposed a small enum of reason codes (see `src/types/api.ts` and `docs/API.md`) | PRD §9 says "reason code" but lists no enum. Codes cover automatic, AI, human, and appeal outcomes. |
| A8 | `confidence` on a Review row is `0.000 – 1.000` (float), not the 1–5 integer used on annotation boxes | Review confidence represents the reviewer's certainty about their decision; 0–1 matches the PRD description of AI confidence threshold. |

---

## Submissions

| # | Assumption | Reason |
|---|---|---|
| A9 | `is_fast_flag` boolean on `submissions` flags unusually fast submissions for human review | PRD §16 mentions "unusually fast submissions" as a fraud control; exact threshold is configurable. |
| A10 | Idempotency keys for `submit` and `claim` are stored in a separate `idempotency_keys` table and expire after 24 hours | PRD says "safe to retry"; table approach is simpler than Redis for hackathon scope. |
| A11 | `submission.version` starts at 1 and increments on each re-submit of the same task | Needed to distinguish revision cycles; PRD says submissions are versioned. |

---

## Jobs

| # | Assumption | Reason |
|---|---|---|
| A12 | `jobs.label_list` is stored on the job itself (duplicated from schema_version) | Allows overriding the default label list per-job without creating a new schema version. |
| A13 | Job status `"paused"` and `"closed"` are included | PRD §12 mentions pausing and closing jobs; modelled here as status transitions. |

---

## Schema versions

| # | Assumption | Reason |
|---|---|---|
| A14 | `version_hash` in seed migration is a placeholder string, not a real keccak256 | The real hash is computed at runtime by the app; the seed just needs a stable unique value. |

---

## Exports

| # | Assumption | Reason |
|---|---|---|
| A15 | Export uses pseudonymous contributor IDs (UUID), not wallet address or email | PRD §14 says "never include worker email, legal name, or other identity data". |

---

## Settlement

| # | Assumption | Reason |
|---|---|---|
| A16 | `receipt.is_mock = true` when MockSettlementService is used | Needed so the UI and audit trail can distinguish real chain receipts from demo receipts. |
