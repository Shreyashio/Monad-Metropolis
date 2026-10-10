# PhysicalData Network --- Product Requirements Document (PRD v2)

**Date:** October 10, 2026\
**Network:** Monad testnet\
**Status:** Hackathon MVP specification

## 1. Overview

PhysicalData Network lets robotics teams post image and video labelling
jobs, have qualified contributors label them for stablecoin rewards, and
pay only for work that passes review. Monad holds the job budget and
payout receipts. Raw footage, full labels, reviewer notes, and
contributor profiles remain in private storage.

**Pitch:** Labels you can trust, because checks are layered, audits are
random, and every payout is tied to a receipt.

### What this version includes

-   Image and video labelling on one shared backend and one shared
    contract.
-   Kimi (Moonshot AI) as the first-pass reviewer for image labels.
-   Human review for video, appeals, low-confidence AI decisions, and
    difficult cases.
-   Privy server wallet as the acceptance signer and money-control
    layer.
-   Chainlink VRF for random gold tasks, reviewer assignment, and audit
    samples, subject to Monad testnet support.
-   JSONL and CSV exports of accepted labels with a provenance manifest.

## 2. Problem

Robots learn from images and video, but raw footage is not training
data. People must identify objects in images and mark when actions start
and end in video. That work must then be checked.

### User pain points

-   **Robotics teams / buyers:** Labels can be noisy and inconsistent;
    reviewing bad labels costs time; audit trails and data rights can be
    unclear.
-   **Contributors:** Instructions may be vague; rejections may lack
    reasons; payment may be slow or reduced by fees; appeals may be
    unavailable.
-   **Reviewers / operators:** Manual review is slow, duplicate or fake
    accounts are hard to spot, and audit trails may be incomplete.

Managed labelling vendors can be expensive and rigid. Open crowd
marketplaces can bring noisy labels, fraud, and privacy risks. Onchain
payments alone do not prove that a label is correct.

**Product position:** Sell accepted, reviewed, export-ready labels with
a receipt for every payout. Blockchain proves workflow and payment
state; quality checks and review address correctness.

## 3. Scope

### In scope

-   Image labelling: bounding boxes and simple answers.
-   Video labelling: timestamped action and failure segments.
-   Escrow, accepted-task receipts, reward claims, pause, and refund
    rules.
-   Email or wallet login with server-side role checks.
-   Automatic checks, hidden gold tasks, Kimi first-pass image review,
    human review for video and difficult cases, and random audits.
-   Accepted-label exports in JSONL and CSV, with a provenance manifest.
-   Invite-only contributor cohort and one buyer for the MVP.

### Out of scope

-   LiDAR, point clouds, depth fusion, and multi-sensor synchronisation.
-   Token launch, staking, DAO, and cross-chain functionality.
-   Full KYC or proof of humanity.
-   Fully autonomous AI acceptance.
-   Public dataset marketplace and open public uploads.

Contributors do not write code. They watch, draw, click, and submit
labels.

## 4. Users and roles

Every request must be authorised on the server.

  -----------------------------------------------------------------------
  Role                    Can do                  Cannot do
  ----------------------- ----------------------- -----------------------
  Buyer                   Create and fund jobs,   Review labels or change
                          set the rubric,         accepted results
                          download exports,       
                          confirm delivery        

  Contributor             Qualify, claim tasks,   Review any work,
                          label, see status and   including their own
                          rewards, claim payouts, 
                          appeal                  

  Reviewer                Accept, request         Review their own
                          revision, reject with a submissions or move
                          reason code, handle     funds
                          appeals                 

  Admin                   Pause jobs, manage      Silently take funds or
                          roles, handle disputes, edit accepted labels
                          operate signer policy   
  -----------------------------------------------------------------------

Wallet ownership proves control of a key, not that the wallet belongs to
a unique human. The product does not claim Sybil resistance.

## 5. Chain choice and data placement

Monad is required by the hackathon and fits a product with many small
settlements. It is EVM-compatible, so Solidity, Foundry, Wagmi, and Viem
can be used. Confirm current network fees, block times, testnet support,
and sponsor compatibility before making claims in the demo.

Testnet rewards have no real-world value. The UI must clearly say so.

### Onchain vs. offchain

  -----------------------------------------------------------------------
  On Monad                            In private offchain storage
  ----------------------------------- -----------------------------------
  Job ID, buyer address, budget,      Raw images and videos
  policy hash, status                 

  Escrowed funds and amounts paid     Full labels and reviewer notes

  Hash of each accepted task,         Task instructions, schemas, QA
  contributor, policy version         output

  Payout-claimable and claimed        Contributor profiles, appeals,
  events, pause state                 consent and rights records
  -----------------------------------------------------------------------

Never put raw media, personal data, or full labels in transaction
calldata or events. A hash proves a record was not changed; it does not
prove the label is correct.

## 6. Architecture

-   **Frontend:** Next.js, React, TypeScript, Tailwind.
-   **Authentication and wallets:** Privy.
-   **Backend:** Next.js API routes in TypeScript.
-   **Database and private storage:** Supabase / Postgres and private
    storage bucket.
-   **Contracts:** Solidity and Foundry.
-   **Chain client:** Wagmi and Viem.
-   **Image labelling:** HTML canvas bounding-box tool or a small
    open-source library.
-   **Video labelling:** HTML5 video player, frame stepping, and custom
    timeline.
-   **Image review:** Kimi (Moonshot AI) API as first-pass reviewer.
-   **Random audits:** Chainlink VRF, if supported on the target
    testnet.
-   **Indexer:** Envio HyperIndex or a small Viem event listener.
-   **Hashing:** keccak256 over canonical JSON.
-   **Network:** Monad testnet with test ERC-20 or a supported sponsor
    stablecoin.

Only job/payment state and hashes belong onchain. Media, labels, and
contributor profiles stay private.

## 7. End-to-end workflow

1.  Buyer defines a testable rubric, schema, reward, deadline, data
    rights, and budget.
2.  Buyer creates and funds a job.
3.  Contributor signs in and passes qualification tasks with known
    answers.
4.  Contributor claims an available task. A lease reserves it for that
    contributor for a limited time.
5.  Contributor labels the image or video; drafts autosave.
6.  The client and server validate the submission.
7.  Review runs through the relevant quality route.
8.  Accepted work becomes eligible for payment; rejected or
    revision-required work is not paid unless an appeal reverses the
    decision.
9.  The authorised Privy server wallet signs the onchain acceptance
    call.
10. The contributor claims the reward, and the contract emits a payout
    receipt/event.
11. Buyer exports accepted labels with a provenance manifest.

### Task states

  -----------------------------------------------------------------------
  State                   Meaning                 Payout
  ----------------------- ----------------------- -----------------------
  Draft                   Contributor is still    None
                          editing                 

  Submitted               Passed client checks    None
                          and is waiting in the   
                          queue                   

  Needs revision          Fixable problem, with a None until accepted
                          rubric reason           

  Accepted                Passed automatic checks Eligible to be paid
                          and review              

  Rejected                Failed the stated       Not paid unless appeal
                          criteria                reverses it

  Appealed                Contributor disputes    Disputed amount remains
                          the result              pending

  Paid                    Settlement confirmed by Complete
                          contract receipt        
  -----------------------------------------------------------------------

## 8. Contributor workflow and labelling

1.  Sign in and read the job rules, reward, deadline, and acceptance
    criteria.
2.  Pass a short qualification using images or clips with known answers.
3.  Browse the task queue and claim a task.
4.  Label the item; the tool autosaves a draft.
5.  Submit; validation errors are shown immediately with a clear reason.
6.  View accepted, needs-revision, or rejected status with a
    plain-language reason.
7.  Claim rewards for accepted work and view the receipt.

### Video annotation

Contributors mark the start and end of actions on a timeline rather than
submitting screenshots.

Example for a 12-second clip of someone writing:

     Start      End Label   Notes
  -------- -------- ------- ------------------------------
     0.0 s    1.2 s reach   Hand moves toward the pen
     1.2 s    3.4 s grasp   Pen is held; outcome success
     3.4 s    4.0 s lift    Pen leaves the table
     4.0 s   11.0 s write   Writing action
    11.0 s   12.0 s place   Pen is set down

The UI should support playback, speed control, frame stepping, timeline
dragging, label selection, object, outcome, failure reason, and
confidence from 1--5. If unsure, contributors should choose `unknown` or
`other` rather than guess.

### Image annotation

Contributors draw a box around each object, select its class, and
optionally answer a short question such as whether a grasp succeeded.
Boxes are stored as pixel coordinates.

### Validation rules

-   Video segments must stay within the clip and must not overlap.
-   Each video segment must have `end_ms > start_ms`.
-   A failure segment must include a failure reason.
-   Image boxes must remain within image bounds, have positive size, and
    use a class from the job's allowed list.
-   Required fields must be present.
-   Client-side validation improves UX, but the server must validate
    again.

## 9. Quality and review

The buyer defines what correct means. Contributors never judge their own
work, and reviewers cannot review their own submissions.

### Review responsibilities

  -----------------------------------------------------------------------
  Judge                   Responsibility          Used for
  ----------------------- ----------------------- -----------------------
  Buyer                   Defines label meanings, Ground-truth rubric
                          required precision, and 
                          acceptance criteria     

  Code                    Schema validation,      Every submission
                          time/box validation,    
                          gold-task scoring,      
                          duplicate detection     

  Kimi (Moonshot AI)      Suggests accept,        First pass for images
                          revise, or reject with  
                          a reason code and       
                          confidence              

  Human reviewer          Final decisions for     Video and difficult
                          video, low-confidence   cases
                          AI cases, appeals, and  
                          audits                  

  Chainlink VRF           Selects random gold     Anti-gaming, if
                          tasks, reviewer         supported
                          assignments, and audit  
                          samples                 
  -----------------------------------------------------------------------

### Layered quality checks

1.  **Automatic checks:** Reject invalid times, overlaps, out-of-bounds
    boxes, missing fields, and invalid schemas with a clear reason.
2.  **Gold tasks:** Mix hidden tasks with known answers into
    qualification and live queues. Score boxes using
    intersection-over-union (IoU), and video segments using timing
    tolerance and label match.
3.  **Overlap sampling:** Some items are labelled by two or three
    contributors. Agreement raises confidence; disagreement goes to a
    reviewer.
4.  **First-pass review:** Kimi reviews image submissions against the
    rubric. Video goes to human review.
5.  **Risk-based human review:** Prioritise low-confidence submissions,
    first-time contributors, unusually fast submissions, and gold-task
    failures.
6.  **Random audits:** Human reviewers re-check a random sample of
    accepted work, including AI-reviewed work. Track human disagreement
    with Kimi.

High-confidence Kimi decisions may be applied under the configured
policy, with the reason shown to the contributor. Low-confidence
decisions and appeals go to humans. The UI and export manifest must mark
every decision as AI-suggested, human-reviewed, or adjudicated.

AI is not the sole authority. Human review remains for video, difficult
cases, appeals, and random audits. Contributor reputation can use gold
accuracy, reviewer agreement, revision rate, and appeal outcomes; do not
issue it as a tradable token and do not show it before enough data
exists.

## 10. Privy: signing and money controls

Privy is used for authentication, wallets, and transaction
controls---not only login.

### Acceptance signer

The acceptance signer is a Privy server wallet. The backend asks Privy
to sign each `markAccepted` call. The signing key must not be stored as
a raw private key in an application `.env` file.

Configure the Privy policy engine to deny actions by default and allow
only calls to the deployed `JobEscrow` contract's acceptance function.
Verify that the required Privy server-wallet and policy features work on
the chosen Monad testnet before relying on them.

### Sensitive actions

Refund, close-job, pause, and policy-change actions should require
approval from more than one key using a quorum, for example buyer plus
admin. Routine accepted-work calls may run automatically within the
restrictive policy.

### Gasless claims

Gas sponsorship is a bonus, subject to network support. If it is
unavailable on Monad, the backend may push payouts to contributors
instead.

Privy login can use email or wallet authentication and embedded wallets
for contributors. Login alone is not the core Privy integration.

**Security limitation:** policy-limited signing reduces risk but does
not remove the central trust in the QA/settlement service. The
application must also verify task state, reviewer permissions, job IDs,
and idempotency before requesting a signature.

## 11. Other sponsor integrations

  -----------------------------------------------------------------------
  Sponsor / tool          Intended use            Fallback
  ----------------------- ----------------------- -----------------------
  Privy                   Server wallet signer,   If required Monad
                          policies, key quorum,   support is unavailable,
                          optional gas            use a clearly
                          sponsorship             documented fallback and
                                                  do not claim the Privy
                                                  bounty

  Chainlink VRF           Random gold tasks,      Use a clearly labelled
                          reviewer assignment,    commit-reveal seed only
                          audit samples           if VRF is unavailable;
                                                  do not claim VRF
                                                  integration

  Kimi                    First-pass image review Human review for all
                          with reason and         images
                          confidence              

  Envio                   Index `JobCreated`,     Small Viem event
                          `TaskAccepted`, and     listener
                          `PayoutClaimed` events  
                          for dashboards and      
                          reconciliation          

  Agora                   Stablecoin rewards, if  Test ERC-20
                          a compatible token      
                          exists on Monad testnet 

  Nansen                  Optional wallet         Excluded from MVP
                          analytics signal for    
                          suspicious accounts     
  -----------------------------------------------------------------------

Confirm each sponsor's current documentation, bounty terms, and
target-network support before implementing or claiming an integration.

## 12. Smart contracts

Keep the contract surface small and modality-agnostic. The contract sees
a task ID hash, annotation hash, contributor, and reward; it does not
need to know whether the work is an image or video.

### Components

-   **JobEscrow:** Create and fund jobs, hold budgets, track reserved
    and paid amounts, and close or refund under published rules.
-   **Acceptance and payout:** Record accepted task hashes with policy
    version, make rewards claimable, and allow each contributor to claim
    only once.
-   **Access control and pause:** Roles for the Privy signer and admin,
    emergency pause, and quorum-gated sensitive actions.
-   **Audit randomness:** Request Chainlink VRF and store the result so
    audit selection can be independently checked.

### Required invariants

-   Total paid never exceeds the funded budget.
-   A task hash can be accepted and paid only once.
-   Only the authorised Privy signer can mark work payable.
-   A paused or closed job accepts no new claims or acceptances.
-   Refunds cannot touch money already owed to contributors.
-   Admin actions are access-controlled and emit events.
-   Raw data and personal information never appear in calldata or
    events.

### Events

`JobCreated`, `JobFunded`, `TaskAccepted`, `PayoutClaimable`,
`PayoutClaimed`, `JobPaused`, `JobClosed`, `PolicyUpdated`, and
`AuditSeedReceived`.

For the MVP, per-task claims are acceptable. Merkle-root batched payouts
can be added later.

### Trust assumptions

Acceptance is signed by the QA service through the Privy signer. This is
a deliberate central point limited by policies and quorum. A hash proves
integrity, not correctness. Testnet tokens have no real value. Contract
code is not audited.

## 13. Data model and API

Use one tasks table with a `modality` field (`image` or `video`) and one
submissions table with label payloads stored as JSON.

### Core entities

-   **User:** `id`, `walletAddress`, `role` (`buyer`, `contributor`,
    `reviewer`, `admin`), `status`
-   **ContributorProfile:** `userId`, qualification result, quality
    stats, consent version
-   **Project:** `id`, `buyerId`, data rights, retention policy
-   **Asset:** `id`, `projectId`, private `objectKey`, `contentHash`,
    `modality`, `durationMs` for video, image width/height, `consentRef`
-   **SchemaVersion:** `id`, `modality`, JSON schema, label list,
    immutable `versionHash`
-   **Job:** `id`, `projectId`, budget, reward per accepted task,
    deadline, `policyHash`, status, chain job ID
-   **Task:** `id`, `jobId`, `assetId`, `modality`, `leaseOwner`,
    `leaseExpiry`, status, `isGold`
-   **Submission:** `id`, `taskId`, `contributorId`, payload JSON,
    `payloadHash`, `submittedAt`; submissions are versioned and never
    overwritten
-   **Review:** `id`, `submissionId`, `reviewerType` (`code`, `ai`,
    `human`), `reviewerId`, decision, `reasonCode`, confidence, rubric
    version
-   **Appeal:** `id`, `submissionId`, reason, status, adjudicator ID
-   **Receipt:** `id`, `submissionId`, `annotationHash`, `policyHash`,
    `reviewRef`, transaction hash
-   **AuditSample:** `id`, `jobId`, VRF request ID, seed, selected task
    IDs

### API endpoints

  ---------------------------------------------------------------------------------------------
  Endpoint                                      Purpose                 Role
  --------------------------------------------- ----------------------- -----------------------
  `POST /api/jobs`                              Create draft job        Buyer

  `POST /api/jobs/{id}/publish`                 Publish after funding   Buyer

  `GET /api/tasks/available`                    List eligible tasks     Contributor

  `POST /api/tasks/{id}/claim`                  Claim a task lease,     Contributor
                                                idempotently            

  `PUT /api/tasks/{id}/draft`                   Autosave draft          Task owner

  `POST /api/tasks/{id}/submit`                 Validate and submit     Task owner

  `POST /api/reviews/{submissionId}/decision`   Accept, revise, or      Reviewer, not author
                                                reject with reason      

  `POST /api/submissions/{id}/appeal`           Appeal rejection        Contributor

  `POST /api/settlement/accept`                 Ask Privy signer to     Settlement service
                                                record accepted task    
                                                onchain                 

  `GET /api/jobs/{id}/export`                   Accepted-only export    Buyer
                                                and manifest            

  `GET /api/receipts/{id}`                      Minimal public receipt  Public
  ---------------------------------------------------------------------------------------------

All input must be validated on the server. Every route checks the Privy
login token and role. Submissions and settlement requests use
idempotency keys.

## 14. Annotation schemas and exports

### Image schema: `image-boxes-v1`

``` json
{
  "task_id": "task_01H...",
  "asset_id": "asset_private_017",
  "schema_version": "image-boxes-v1",
  "boxes": [
    { "x": 120, "y": 80, "w": 90, "h": 110, "class": "cup", "confidence": 4 },
    { "x": 300, "y": 210, "w": 40, "h": 40, "class": "red_block", "confidence": 5 }
  ],
  "answers": { "grasp_success": "yes" }
}
```

Boxes must be within image bounds, have positive dimensions, and use
allowed classes. Score box overlap against gold boxes using IoU.

### Video schema: `action-segments-v1`

``` json
{
  "task_id": "task_01H...",
  "asset_id": "asset_private_042",
  "schema_version": "action-segments-v1",
  "segments": [
    {
      "start_ms": 1200,
      "end_ms": 3400,
      "action_label": "grasp",
      "object": "pen",
      "outcome": "success",
      "confidence": 4
    },
    {
      "start_ms": 4000,
      "end_ms": 11000,
      "action_label": "write",
      "object": "pen",
      "outcome": "success",
      "confidence": 4
    }
  ]
}
```

`start_ms` must be zero or greater; `end_ms` must exceed `start_ms` and
remain within the clip. Segments must be ordered and non-overlapping.
`failure_reason` is required when outcome is `failure`. Supported
labels: `reach`, `grasp`, `lift`, `place`, `inspect`, `recover`,
`write`, `other`.

### Exports

-   Images: COCO-style JSON.
-   Videos: JSONL for nested segments and CSV for flat rows.
-   Include a manifest with dataset ID, schema version, asset hashes,
    rights reference, review-policy version, reviewer type per record,
    export time, and record counts.
-   Export accepted records only.
-   Never include worker email, legal name, or other identity data.

## 15. UI and UX requirements

Laptop-first; mobile labelling is out of scope for the MVP. Keep the
interface calm, with one accent colour, a large work area, and
plain-language statuses.

  -----------------------------------------------------------------------
  Screen                  Must show               Main action
  ----------------------- ----------------------- -----------------------
  Landing                 Buyer value,            Create job or join
                          contributor payment     cohort
                          explanation, privacy    
                          stance                  

  Buyer job wizard        Data type, schema,      Publish and fund
                          rubric, budget, reward, 
                          deadline, data rights   

  Buyer dashboard         Tasks done, review      Export or close job
                          queue, acceptance rate, 
                          spend, budget left,     
                          AI/human review share   

  Contributor onboarding  Sign-in, rules, privacy Start qualification
                          note, sample task       

  Task queue              Reward, effort,         Claim task
                          deadline, data type     

  Image workbench         Image, box tool, class  Submit
                          palette, rubric,        
                          examples                

  Video workbench         Player, frame stepping, Submit
                          timeline, segment form, 
                          rubric                  

  Review console          Item, rubric,           Accept, revise, reject
                          submission              
                          vs. reference, AI       
                          suggestion, reason,     
                          confidence              

  Contributor earnings    Accepted, pending,      Claim payout
                          rejected, appealed      
                          work, receipts          

  Receipt view            Task ID, policy hash,   Verify
                          annotation hash,        
                          reviewer type,          
                          transaction link        

  Admin                   Pause, role management, Pause or approve
                          signer policy status,   
                          quorum approvals        
  -----------------------------------------------------------------------

### UX rules

-   Show reward and rubric before task claim.
-   Explain statuses and rejection reasons in plain language.
-   Status colours: grey pending, amber needs revision, green accepted,
    red rejected, purple paid.
-   Submitted, accepted, and paid are distinct states.
-   Do not show reputation scores before enough data exists.
-   Mark labels and decisions as human-made, AI-suggested, reviewed, or
    adjudicated.
-   Every action needs loading, error, and retry states.

## 16. Security, privacy, and trust

-   **Private media:** Storage buckets must never be public. Use signed
    playback links that expire within minutes; check user role and job
    on every link request.
-   **Minimal onchain data:** Only hashes, amounts, and state; no raw
    media, personal data, or full labels in calldata/events.
-   **Signing key:** Held by Privy and policy-limited to the contract
    acceptance function; quorum required for refund, close, pause, and
    policy changes.
-   **Role enforcement:** Check roles on every server route.
    Contributors cannot see reviewer-only data; reviewers cannot review
    their own work.
-   **Fraud controls:** Rate limits, task leases, idempotency keys,
    duplicate-payload detection, and unusually fast submission flags. A
    flag triggers human review, not automatic punishment.
-   **AI review:** Kimi suggests decisions; label them as AI decisions,
    randomly audit accepted AI-reviewed work, and allow human appeals.
-   **Data rights:** Buyer attests they may share the data. Use
    synthetic or permission-cleared media for the demo.
-   **Money:** Testnet only. Real stablecoin payouts require legal, tax,
    and token review.

### Limitations to disclose

-   Acceptance is signed by the QA service. It is policy-limited but
    still a central trust point.
-   A hash proves integrity, not label correctness.
-   Wallet ownership is not proof of a unique person.
-   AI review is not a perfect judge.
-   Smart contracts are not audited.

## 17. Build plan

The original PRD assumes approximately 2--3 days of hackathon build
time. Confirm the deadline and current sponsor requirements on the event
portal.

1.  **Contracts, auth, and database:** Build and test budget,
    double-pay, and access controls; make login work for all roles.
2.  **Image workflow:** Complete job creation to payout, including Kimi
    first-pass review.
3.  **Video workflow:** Reuse backend and contract; complete clip
    labelling to payout.
4.  **Settlement and export:** Add Privy server-wallet signer/policy,
    buyer dashboard, and export.
5.  **Random audits and indexing:** Add Chainlink VRF and Envio if
    supported and time permits.
6.  **Final hours:** Demo script, error states, README, demo video, and
    clean-browser test.

### Team lanes

-   Lane 1: Contracts, settlement, Chainlink.
-   Lane 2: Privy auth, signer, policies, backend, database.
-   Lane 3: Image workbench and Kimi review.
-   Lane 4: Video workbench and review console.

Agree database schema and API shapes early. By the end of day one, image
labelling should work from job creation to payout. If it does not, cut
video AI, appeals, and Envio, and simplify login.

### Cut list if time runs out

Appeals, reputation score, consensus labelling, batched payouts, gas
sponsorship, Agora token, Nansen, and extra schemas.

## 18. Demo script

Aim for one complete story under four minutes. Use synthetic or
permission-cleared media only.

1.  Buyer creates a job with a rubric and reward.
2.  Fund the job with a testnet token; show escrow on Monad.
3.  Contributor signs in with Privy and passes a gold task.
4.  Contributor draws boxes on an image.
5.  Kimi returns an image-review decision, reason, and confidence.
6.  Contributor labels a video clip with actions such as reach, grasp,
    and failure.
7.  Submit an invalid label (for example, end time before start) and
    show rejection with a reason and no payout.
8.  Reviewer accepts valid work; show receipt hash, policy version, and
    reviewer type.
9.  Privy server wallet signs acceptance; contributor claims reward with
    no double claim.
10. Show the Chainlink random audit result on Monad, if integrated.
11. Buyer downloads accepted-label export and provenance manifest.

Fallback: preload a sample job but show at least one live transaction.
If a transaction fails, show the error; do not fake success. A recording
may be used if clearly labelled as a recording. One complete flow is
better than many incomplete screens.

## 19. Risks and open questions

  -----------------------------------------------------------------------
  Risk / question         Severity                Mitigation
  ----------------------- ----------------------- -----------------------
  Two modalities in a     High                    Shared backend and
  short build window                              contract; image flow
                                                  first; day-one
                                                  checkpoint

  Privy does not support  High                    Verify first; use
  Monad testnet server                            documented fallback and
  wallets, policies, or                           drop unsupported bounty
  gas sponsorship                                 claims

  Chainlink VRF           Medium                  Labelled commit-reveal
  unavailable on Monad                            fallback; do not claim
  testnet                                         VRF integration

  Kimi image input/model  Medium                  Verify API;
  limits                                          human-review all images
                                                  if needed

  Kimi approves bad       High                    Confidence threshold,
  labels                                          random human audits,
                                                  human appeal

  Fake or duplicate       High                    Qualification, leases,
  contributors                                    anomaly flags; no
                                                  Sybil-proof claim

  Payout bug or contract  Critical                Small contract, tests,
  exploit                                         capped demo funds,
                                                  pause, quorum for
                                                  sensitive actions

  Privacy leak            Critical                Private bucket,
                                                  expiring links, role
                                                  checks

  Mera and Privy bounty   Low                     Choose one
  conflict                                        account-layer approach

  No buyer demand after   Critical                Validate with robotics
  hackathon                                       teams and real clips
                                                  before expanding
  -----------------------------------------------------------------------

Open questions to verify: exact deadline; sponsor bounty terms; Privy
support on Monad testnet; Chainlink VRF availability; Kimi image input
support; and whether Agora's token exists on the target testnet.

## 20. Product success criteria

The MVP is ready to demo when:

-   A buyer can create and fund a job.
-   A contributor can qualify, claim, label, and submit an image task.
-   A valid submission can be reviewed and accepted.
-   An invalid submission is rejected with a clear reason.
-   Only authorised acceptance can make a reward claimable.
-   The same task cannot be accepted or paid twice.
-   Total payouts cannot exceed the funded budget.
-   The contributor can claim a reward and see a transaction receipt.
-   The buyer can export accepted labels and a provenance manifest.
-   Raw media and personal data never appear onchain.
-   The end-to-end flow works from a clean browser session.

## 21. FAQ

**What problem are we solving?**\
Robots need large amounts of labelled images and video. We provide a
workflow for contributors to label data, quality checks to catch bad
work, and payment only for accepted work.

**How do we reduce junk labels?**\
Use schema checks, hidden gold tasks, overlap sampling, Kimi first-pass
review for images, human review for video and difficult cases, and
random audits.

**Does a contributor need to code?**\
No. They view images or clips, draw boxes or mark time ranges, select
labels, and submit.

**Can Kimi be the only judge?**\
No. Kimi suggests decisions for images. Humans review video,
low-confidence cases, appeals, and random audits.

**What does Privy do beyond login?**\
It provides the policy-limited server wallet that signs acceptance
calls, plus quorum controls for sensitive actions. Gas sponsorship is
optional and depends on network support.

**What does Chainlink VRF do?**\
If supported, it supplies verifiable randomness for selecting gold
tasks, reviewers, and audit samples.

**Does a hash prove the label is correct?**\
No. It helps prove that the recorded data has not changed. Correctness
comes from the rubric and quality-review process.

**Are rewards real money?**\
The demo uses testnet tokens with no real value. Real stablecoin payouts
require further legal, tax, and token review.

**Is the smart contract audited?**\
No. The MVP contract is not audited; use capped testnet funds and do not
imply otherwise.

------------------------------------------------------------------------

## Implementation notes

-   Keep all secrets out of source control.
-   Do not store a raw Privy signing key in `.env`; use the Privy
    server-wallet flow and restrictive policies.
-   Use synthetic or rights-cleared media for the demo.
-   Verify all sponsor integrations and target-network support before
    claiming them.
-   Do not describe testnet tokens as having real monetary value.
