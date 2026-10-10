# PhysicalData Network – API Contract

**Version:** 0.1.0 (Phase 0–1 — Scaffold + Migrations)  
**Base URL:** `http://localhost:3000` (dev)

All responses use the standard envelope:

```json
// Success
{ "data": <T> }

// Failure  
{ "error": { "code": "STRING", "message": "Human-readable text", "details": {} } }
```

---

## Enums

### `UserRole`
`buyer` | `contributor` | `reviewer` | `admin`

### `UserStatus`
`active` | `suspended`

### `Modality`
`image` | `video`

### `JobStatus`
`draft` | `published` | `paused` | `closed`

### `TaskStatus`
| Status | Meaning | Payout eligible? |
|---|---|---|
| `available` | Unclaimed, ready for contributors | No |
| `claimed` | Lease held, editing not yet started | No |
| `draft` | Contributor is editing | No |
| `submitted` | Awaiting review | No |
| `needs_revision` | Fixable issue; contributor must revise | No |
| `accepted` | Passed all checks and review | Yes |
| `rejected` | Failed stated criteria | Only via appeal |
| `appealed` | Contributor disputed result | Pending |
| `paid` | Settlement confirmed | Yes (done) |

### `ReviewerType`
`code` | `ai` | `human`

### `ReviewDecision`
`accept` | `revise` | `reject`

### `AppealStatus`
`open` | `accepted` | `rejected`

### `ReasonCode`
| Code | Used by | Meaning |
|---|---|---|
| `SCHEMA_INVALID` | code | Payload failed schema validation |
| `BOX_OUT_OF_BOUNDS` | code | Box exceeds image dimensions |
| `BOX_NEGATIVE_SIZE` | code | Box w or h ≤ 0 |
| `BOX_INVALID_CLASS` | code | Class not in job's label list |
| `SEGMENT_OUT_OF_BOUNDS` | code | Segment exceeds clip duration |
| `SEGMENT_OVERLAP` | code | Segments overlap each other |
| `SEGMENT_ORDER` | code | Segments not in ascending start_ms order |
| `SEGMENT_MISSING_FAILURE_REASON` | code | outcome=failure without failure_reason |
| `GOLD_FAIL` | code | Failed hidden gold task |
| `DUPLICATE_PAYLOAD` | code | Identical payload hash already submitted |
| `FAST_SUBMISSION_FLAG` | code | Submitted unusually fast (human review triggered) |
| `LOW_QUALITY` | ai, human | General quality issue |
| `MISSING_OBJECTS` | ai, human | Expected objects not labelled |
| `WRONG_CLASS` | ai, human | Correct position, wrong class |
| `IMPRECISE_TIMING` | ai, human | Video segment times too loose |
| `INCONSISTENT_LABELS` | ai, human | Contradictory labels |
| `RUBRIC_VIOLATION` | ai, human | Specific rubric criterion not met |
| `APPEAL_UPHELD` | human | Reviewer reversed the original decision |
| `APPEAL_DISMISSED` | human | Original decision stands |
| `ACCEPTED` | all | All checks passed |

### `ActionLabel` (video)
`reach` | `grasp` | `lift` | `place` | `inspect` | `recover` | `write` | `other`

### `SegmentOutcome` (video)
`success` | `partial` | `failure` | `unknown`

---

## Task State Machine

Legal transitions:

```
available  → claimed
claimed    → draft | available
draft      → submitted | available
submitted  → needs_revision | accepted | rejected
needs_revision → draft
accepted   → paid
rejected   → appealed
appealed   → accepted | rejected
paid       → (terminal)
```

**Rules:**
- A rejected task is **never** paid directly.
- An accepted task is paid **at most once**.
- A contributor cannot review their own submission.

---

## Authentication

### Production
All routes (except `GET /api/health` and `GET /api/receipts/:id`) require a valid Privy access token in the `Authorization: Bearer <token>` header.

### Development (`DEV_AUTH_BYPASS=true`)
Pass the user's UUID in the `x-dev-user-id` header. The user must already exist in the database. **Refused in production.**

### Error responses
| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Valid token but insufficient role |

---

## Idempotency

The following endpoints accept an `Idempotency-Key` header. On retry with the same key, the original response is returned without re-executing the action:
- `POST /api/tasks/{id}/claim`
- `POST /api/tasks/{id}/submit`
- `POST /api/settlement/accept`

---

## Endpoints

---

### `GET /api/health`

**Purpose:** Server health check  
**Auth:** None  
**Roles:** Public

**Success `200`:**
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-10-11T00:00:00.000Z",
    "version": "0.1.0"
  }
}
```

---

### `GET /api/me`

**Purpose:** Get the currently authenticated user  
**Auth:** Required  
**Roles:** All

**Success `200`:**
```json
{
  "data": {
    "id": "uuid",
    "wallet_address": "0xabc...",
    "email": "user@example.com",
    "role": "contributor",
    "status": "active",
    "created_at": "2026-10-11T00:00:00.000Z",
    "profile": {
      "qualification_passed": true,
      "tasks_completed": 12,
      "gold_accuracy": 87.5
    }
  }
}
```

---

### `POST /api/jobs`

**Purpose:** Create a draft job  
**Auth:** Required  
**Roles:** `buyer`

**Request body:**
```json
{
  "project_id": "uuid",
  "title": "Cup and Block Detection",
  "description": "Draw bounding boxes around all cups and blocks.",
  "modality": "image",
  "reward_per_task": 1.5,
  "budget": 100.0,
  "deadline": "2026-11-01T00:00:00.000Z",
  "rubric": { "accepted_iou": 0.5 },
  "label_list": ["cup", "red_block", "blue_block"],
  "schema_version_id": "uuid"
}
```

**Success `201`:** `Job` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Missing or invalid fields |
| `FORBIDDEN` | 403 | Not a buyer |

---

### `POST /api/jobs/{id}/publish`

**Purpose:** Publish a job (make tasks available)  
**Auth:** Required  
**Roles:** `buyer` (must own the job)

**Success `200`:** `Job` object with `status: "published"`

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | Job not found |
| `FORBIDDEN` | 403 | Not the job owner |
| `CONFLICT` | 409 | Job not in `draft` state |

---

### `GET /api/jobs`

**Purpose:** List jobs  
**Auth:** Required  
**Roles:** `buyer` (own jobs), `admin` (all jobs)

**Query params:** `status`, `modality`, `page`, `per_page`

**Success `200`:** `PaginatedList<Job>`

---

### `GET /api/jobs/{id}`

**Purpose:** Get a single job  
**Auth:** Required  
**Roles:** `buyer` (own jobs), `admin`

**Success `200`:** `Job` object

---

### `GET /api/tasks/available`

**Purpose:** List available tasks for claiming  
**Auth:** Required  
**Roles:** `contributor`

**Query params:** `job_id`, `modality`, `page`, `per_page`

**Success `200`:** `PaginatedList<Task>` (gold_answer never included)

**Notes:** Expired leases are released (status reset to `available`) as a side effect of this query.

---

### `POST /api/tasks/{id}/claim`

**Purpose:** Claim a task lease (atomic, idempotent)  
**Auth:** Required  
**Roles:** `contributor`  
**Headers:** `Idempotency-Key: <uuid>`

**Success `200`:**
```json
{
  "data": {
    "task_id": "uuid",
    "lease_expiry": "2026-10-11T00:30:00.000Z",
    "signed_media_url": "https://..."
  }
}
```

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | Task not found |
| `CONFLICT` | 409 | Task already claimed by another contributor |
| `RATE_LIMIT` | 429 | Too many claim attempts |

---

### `GET /api/tasks/{id}`

**Purpose:** Get task details including a short-lived signed media URL  
**Auth:** Required  
**Roles:** `contributor` (own claimed tasks), `reviewer`, `admin`

**Success `200`:** `Task` object with `signed_media_url` (5-minute expiry)

---

### `PUT /api/tasks/{id}/draft`

**Purpose:** Autosave a draft annotation  
**Auth:** Required  
**Roles:** `contributor` (lease owner only)

**Request body:** `ImageBoxesPayload | ActionSegmentsPayload`

**Success `200`:** `{ task_id, saved_at }`

---

### `POST /api/tasks/{id}/submit`

**Purpose:** Validate and submit an annotation  
**Auth:** Required  
**Roles:** `contributor` (lease owner only)  
**Headers:** `Idempotency-Key: <uuid>`

**Request body:** `ImageBoxesPayload | ActionSegmentsPayload`

**Success `201`:** `Submission` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Schema, bounds, or overlap errors (field-level details) |
| `CONFLICT` | 409 | Lease expired or task not in submittable state |
| `RATE_LIMIT` | 429 | Too many submit attempts |

**422 details example:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": ["boxes", 0, "w"], "message": "w must be positive" },
      { "path": ["boxes", 0, "class"], "message": "class 'unknown' is not in the job label list" }
    ]
  }
}
```

---

### `GET /api/review/queue`

**Purpose:** List submissions awaiting review  
**Auth:** Required  
**Roles:** `reviewer`, `admin`

**Query params:** `modality`, `reviewer_type`, `page`, `per_page`

**Success `200`:** `PaginatedList<Submission & { task: Task; job: Job }>`

---

### `POST /api/reviews/{submissionId}/decision`

**Purpose:** Accept, revise, or reject a submission  
**Auth:** Required  
**Roles:** `reviewer`, `admin`  
**Constraint:** Reviewer must not be the submission's contributor

**Request body:**
```json
{
  "decision": "accept",
  "reason_code": "ACCEPTED",
  "confidence": 0.92,
  "notes": "All objects correctly labelled.",
  "rubric_version": "v1.0"
}
```

**Success `200`:** `Review` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `FORBIDDEN` | 403 | Reviewer is the submission author |
| `NOT_FOUND` | 404 | Submission not found |
| `CONFLICT` | 409 | Submission already has a final decision |

---

### `POST /api/submissions/{id}/appeal`

**Purpose:** Appeal a rejection  
**Auth:** Required  
**Roles:** `contributor` (must own the submission)

**Request body:**
```json
{ "reason": "The box position was correct; I believe the class was misread." }
```

**Success `201`:** `Appeal` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | Submission not found |
| `CONFLICT` | 409 | Submission not in `rejected` state |

---

### `GET /api/review/appeals/queue`

**Purpose:** List open appeals for adjudication (inferred extension; see PROGRESS Phase 8)  
**Auth:** Required  
**Roles:** `reviewer`, `admin`

**Query params:** `page`, `per_page` (default 20, max 100)

**Success `200`:** `PaginatedList<AppealQueueItem>` where `AppealQueueItem = Appeal & { submission, task, job }`

---

### `POST /api/appeals/{id}/decision`

**Purpose:** Uphold or dismiss an appeal (inferred extension; see PROGRESS Phase 8)  
**Auth:** Required  
**Roles:** `reviewer`, `admin` (never the appeal's own contributor)

**Request body:**
```json
{
  "decision": "accept",
  "reason_code": "APPEAL_UPHELD",
  "notes": "Re-reviewed; box position correct, class corrected."
}
```

`decision` = `accept` (upheld → task `accepted`) | `reject` (dismissed → task `rejected`).
`reason_code` must match: `accept` → `APPEAL_UPHELD`, `reject` → `APPEAL_DISMISSED`.

**Success `200`:** resolved `Appeal` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | Appeal not found |
| `FORBIDDEN` | 403 | Reviewer is the appeal's contributor |
| `CONFLICT` | 409 | Appeal already resolved |
| `VALIDATION_ERROR` | 422 | reason_code does not match decision |

---

### `POST /api/settlement/accept`

**Purpose:** Trigger settlement for an accepted task  
**Auth:** Required  
**Roles:** `admin`  
**Headers:** `Idempotency-Key: <uuid>`

**Request body:**
```json
{
  "task_id": "uuid",
  "submission_id": "uuid"
}
```

**Success `200`:** `Receipt` object

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | Task or submission not found |
| `CONFLICT` | 409 | Task not in `accepted` state or already paid |

---

### `GET /api/jobs/{id}/export`

**Purpose:** Export accepted labels with provenance manifest  
**Auth:** Required  
**Roles:** `buyer` (own jobs), `admin`

**Query params:** `format` = `json` (COCO) | `jsonl` | `csv`

**Success `200`:** File download (Content-Type varies)

**Manifest fields:**
- `dataset_id` (job ID)
- `schema_version`
- `asset_hashes`
- `rights_reference`
- `review_policy_version`
- `reviewer_type` per record (`ai` | `human`)
- `export_time`
- `record_counts`

---

### `GET /api/receipts/{id}`

**Purpose:** Public minimal receipt  
**Auth:** None (public)  
**Roles:** Public

**Success `200`:**
```json
{
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "policy_hash": "0x...",
    "annotation_hash": "0x...",
    "reviewer_type": "ai",
    "tx_hash": "0x...",
    "is_mock": false,
    "created_at": "2026-10-11T00:00:00.000Z"
  }
}
```

---

### `GET /api/earnings`

**Purpose:** Contributor earnings summary  
**Auth:** Required  
**Roles:** `contributor`

**Success `200`:** `EarningsSummary`

---

## Error code reference

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid auth token |
| 403 | `FORBIDDEN` | Insufficient role or ownership |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | State conflict (already claimed, already paid, etc.) |
| 422 | `VALIDATION_ERROR` | Schema / bounds / field validation failed |
| 429 | `RATE_LIMIT` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

*This document is updated after each build phase. Last updated: Phase 8.*
