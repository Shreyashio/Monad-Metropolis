# OPEN_QUESTIONS.md

Questions that must be answered before the relevant code can be fully implemented.
Items are grouped by phase. Each item has the affected code path noted.

---

## Auth – Privy

| # | Question | Affects | Status |
|---|---|---|---|
| OQ1 | What is the exact call to verify a Privy access token server-side? Does Privy publish an npm package (`@privy-io/server-auth`)? What are the method names and return shape? | `lib/auth/verifyToken.ts` | ⏳ Pending – currently a TODO stub |
| OQ2 | Does Privy's server-auth SDK work without a full HTTP request (i.e., does it verify JWTs locally or must it hit Privy's servers)? What are the failure modes? | `lib/auth/verifyToken.ts` | ⏳ Pending |
| OQ3 | What field in the Privy token payload maps to the user's wallet address and/or email? Is there a stable "did" field? | `lib/auth/verifyToken.ts` | ⏳ Pending |

---

## AI Review – Kimi (Moonshot)

| # | Question | Affects | Status |
|---|---|---|---|
| OQ4 | What is the Kimi/Moonshot API base URL, authentication method (API key header?), and model identifier for multimodal image review? | `lib/review/KimiAiReviewer.ts` | ⏳ Pending – MockAiReviewer ships instead |
| OQ5 | Does Kimi accept image URLs or base64-encoded images? Is there a size/resolution limit? | `lib/review/KimiAiReviewer.ts` | ⏳ Pending |
| OQ6 | What does a Kimi response look like (JSON structure, field names)? How do we extract a decision, reason, and confidence value? | `lib/review/KimiAiReviewer.ts` | ⏳ Pending |

---

## Smart Contracts – JobEscrow

| # | Question | Affects | Status |
|---|---|---|---|
| OQ7 | What is the ABI of the `JobEscrow` contract? Specifically: function signature for `markAccepted`, parameters, and return type. | `contracts/abi/JobEscrow.json`, `lib/settlement/RealSettlementService.ts` | ⏳ Pending – MockSettlementService ships instead |
| OQ8 | What is the deployed `JobEscrow` contract address on Monad testnet? | `JOB_ESCROW_ADDRESS` env var | ⏳ Pending |
| OQ9 | Does Monad testnet support Privy server wallets and restrictive signing policies as of today? | `lib/settlement/RealSettlementService.ts` | ⏳ Pending |

---

## Privy Server Wallet / Settlement

| # | Question | Affects | Status |
|---|---|---|---|
| OQ10 | What is the exact Privy server-wallet API call to sign and send a transaction? (SDK method names, parameters, response shape.) | `lib/settlement/RealSettlementService.ts` | ⏳ Pending |
| OQ11 | How does Privy's policy engine restrict signing to a single contract function? Where is the policy configured? | Privy dashboard / `RealSettlementService.ts` | ⏳ Pending |
| OQ12 | Can Privy server wallets do gasless transactions on Monad testnet? If so, what is the sponsorship setup? | `lib/settlement/RealSettlementService.ts` | ⏳ Pending |

---

## Chainlink VRF

| # | Question | Affects | Status |
|---|---|---|---|
| OQ13 | Is Chainlink VRF available on Monad testnet? If not, is there a planned deployment date? | `lib/audit/vrfClient.ts` | ⏳ Pending – commit-reveal fallback ships instead |
| OQ14 | If VRF is available: what is the VRF coordinator address, key hash, and subscription ID format on Monad? | Contract + backend | ⏳ Pending |

---

## Monad / Network

| # | Question | Affects | Status |
|---|---|---|---|
| OQ15 | What is the stable Monad testnet RPC URL and chain ID? | `MONAD_RPC_URL` env var, `viem` client | ⏳ Pending |
| OQ16 | Is there a supported stablecoin (Agora or otherwise) on Monad testnet that should be used for rewards, or does the demo use a test ERC-20? | Contract deployment + UI | ⏳ Pending |

---

## Supabase Storage

| # | Question | Affects | Status |
|---|---|---|---|
| OQ17 | What is the correct Supabase Storage API call to generate a **short-lived signed URL** for a private bucket object? The SDK method and expiry parameters. | `app/api/tasks/[id]/route.ts` | ✅ Using `storage.from(bucket).createSignedUrl(path, expiresIn)` – verify SDK version |

---

## Fast-submission threshold

| # | Question | Affects | Status |
|---|---|---|---|
| OQ18 | What is the minimum acceptable time (seconds) between task claim and submission before we flag as "suspiciously fast"? | `lib/tasks/fastSubmitGuard.ts` | ⏳ Pending – placeholder of 30 seconds assumed |
