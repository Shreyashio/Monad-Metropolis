/**
 * Settlement orchestration (mock).
 *
 * Phase 6: settlement of accepted tasks is recorded against the real
 * JobEscrow contract only when `JOB_ESCROW_ADDRESS` + `MONAD_RPC_URL` are
 * configured. In every demo/dev environment the `MockSettlementService`
 * produces a deterministic mock transaction hash and sets `is_mock = true`.
 *
 * Invariants enforced here (PRD §10):
 *   - a task can be paid AT MOST ONCE (state `accepted -> paid`);
 *   - total payouts for a job never exceed its funded `budget`;
 *   - a receipt is written for every payout, linked to the hash of the accepted
 *     annotation and the reviewed policy.
 */

import { getSupabase } from "@/lib/db/supabase";
import { HttpError } from "@/lib/api/errors";
import { hashCanonicalJson } from "@/lib/hash";
import {
  loadTask,
  toTask,
  updateTaskStatus,
} from "@/lib/tasks/repository";
import { assertLegalTransition } from "@/lib/tasks/stateMachine";
import { loadSubmission } from "@/lib/review/repository";
import { toJob, type JobRow } from "@/lib/jobs/repository";
import {
  countPaidTasksInJob,
  incrementTasksCompleted,
  insertReceipt,
  loadAcceptingReview,
  loadReceiptRow,
} from "@/lib/settlement/repository";
import { sumDecimalStrings, withinBudget } from "@/lib/settlement/money";
import type {
  EarningsSummary,
  Job,
  PublicReceipt,
  Receipt,
  ReviewerType,
  TaskStatus,
} from "@/src/types/api";

// ------------------------------------------------------------
// Settlement service (mock while the contract is not wired up)
// ------------------------------------------------------------

export interface SettlementResult {
  tx_hash: string | null;
  is_mock: boolean;
}

export interface SettlementRequest {
  taskId: string;
  submissionId: string;
  annotationHash: string;
  policyHash: string;
  amount: string;
}

export interface SettlementService {
  settle(req: SettlementRequest): Promise<SettlementResult>;
}

export class MockSettlementService implements SettlementService {
  async settle(req: SettlementRequest): Promise<SettlementResult> {
    return {
      tx_hash: hashCanonicalJson({
        task_id: req.taskId,
        submission_id: req.submissionId,
        amount: req.amount,
        mock: true,
      }),
      is_mock: true,
    };
  }
}

export const mockSettlementService = new MockSettlementService();

// ------------------------------------------------------------
// Settlement of an accepted task
// ------------------------------------------------------------

async function loadJobForSettlement(jobId: string): Promise<Job> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw HttpError.internal(`Failed to load job: ${error.message}`);
  if (!data) throw HttpError.notFound("Job not found");
  return toJob(data as JobRow);
}

export interface SettleAcceptedTaskInput {
  taskId: string;
  submissionId: string;
  settlementService?: SettlementService;
}

export async function settleAcceptedTask(
  input: SettleAcceptedTaskInput,
): Promise<Receipt> {
  const service = input.settlementService ?? mockSettlementService;

  const submission = await loadSubmission(input.submissionId);
  if (submission.task_id !== input.taskId) {
    throw HttpError.conflict("Submission does not belong to this task");
  }

  const task = toTask(await loadTask(input.taskId));
  if (task.status === "paid") {
    throw HttpError.conflict("Task has already been paid");
  }
  if (task.status !== "accepted") {
    throw HttpError.conflict("Task is not in an accepted state");
  }

  const job = await loadJobForSettlement(task.job_id);
  const paidCount = await countPaidTasksInJob(task.job_id);
  if (!withinBudget(job.reward_per_task, paidCount + 1, job.budget)) {
    throw HttpError.conflict("Job budget exhausted");
  }

  const acceptingReview = await loadAcceptingReview(input.submissionId);
  const annotationHash = submission.payload_hash;
  const policyHash = job.policy_hash ?? hashCanonicalJson(job.rubric ?? {});

  const settlement = await service.settle({
    taskId: input.taskId,
    submissionId: input.submissionId,
    annotationHash,
    policyHash,
    amount: job.reward_per_task,
  });

  assertLegalTransition("accepted", "paid");

  const receipt = await insertReceipt({
    submissionId: input.submissionId,
    annotationHash,
    policyHash,
    reviewRef: acceptingReview?.id ?? null,
    txHash: settlement.tx_hash,
    isMock: settlement.is_mock,
  });

  await updateTaskStatus(task.id, "paid");
  await incrementTasksCompleted(submission.contributor_id);

  return receipt;
}

// ------------------------------------------------------------
// Public receipt lookup (GET /api/receipts/{id}, no auth)
// ------------------------------------------------------------

export async function getPublicReceipt(receiptId: string): Promise<PublicReceipt> {
  const row = await loadReceiptRow(receiptId);
  const supabase = getSupabase();

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("task_id")
    .eq("id", row.submission_id)
    .maybeSingle();
  if (submissionError) {
    throw HttpError.internal(`Failed to load receipt submission: ${submissionError.message}`);
  }
  if (!submission?.task_id) {
    throw HttpError.internal("Receipt submission is missing");
  }

  let reviewerType: ReviewerType | null = null;
  const reviewRef = (row.review_ref as string | null) ?? null;
  if (reviewRef) {
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("reviewer_type")
      .eq("id", reviewRef)
      .maybeSingle();
    if (reviewError) {
      throw HttpError.internal(`Failed to load receipt review: ${reviewError.message}`);
    }
    reviewerType = (review?.reviewer_type as ReviewerType | undefined) ?? null;
  }

  return {
    id: row.id as string,
    task_id: submission.task_id as string,
    policy_hash: row.policy_hash as string,
    annotation_hash: row.annotation_hash as string,
    reviewer_type: reviewerType,
    tx_hash: (row.tx_hash as string | null) ?? null,
    is_mock: Boolean(row.is_mock),
    created_at: row.created_at as string,
  };
}

// ------------------------------------------------------------
// Contributor earnings summary (GET /api/earnings)
// ------------------------------------------------------------

type EarningsRow = {
  id: string;
  task_id: string;
  version: number;
  submitted_at: string;
  task: { job_id: string; status: TaskStatus };
};

export async function getEarningsSummary(
  contributorId: string,
): Promise<EarningsSummary> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, task_id, version, submitted_at, task:tasks!inner(job_id, status)")
    .eq("contributor_id", contributorId)
    .order("version", { ascending: false });
  if (error) throw HttpError.internal(`Failed to load earnings: ${error.message}`);

  // Dedupe by task, keeping the highest submission version for each.
  const unique = new Map<string, EarningsRow>();
  for (const raw of data ?? []) {
    const row = raw as unknown as EarningsRow;
    if (!unique.has(row.task_id)) unique.set(row.task_id, row);
  }
  const taskRows = Array.from(unique.values());

  const jobIds = Array.from(new Set(taskRows.map((r) => r.task.job_id)));
  const jobMap = new Map<string, { title: string; reward_per_task: string }>();
  if (jobIds.length > 0) {
    const { data: jobs, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, reward_per_task")
      .in("id", jobIds);
    if (jobError) {
      throw HttpError.internal(`Failed to load earnings jobs: ${jobError.message}`);
    }
    for (const job of jobs ?? []) {
      jobMap.set(job.id as string, {
        title: job.title as string,
        reward_per_task: String(job.reward_per_task),
      });
    }
  }

  const submissionIds = taskRows.map((r) => r.id);
  const txBySubmission = new Map<string, string | null>();
  if (submissionIds.length > 0) {
    const { data: receipts, error: receiptError } = await supabase
      .from("receipts")
      .select("submission_id, tx_hash")
      .in("submission_id", submissionIds);
    if (receiptError) {
      throw HttpError.internal(`Failed to load earnings receipts: ${receiptError.message}`);
    }
    for (const receipt of receipts ?? []) {
      txBySubmission.set(
        receipt.submission_id as string,
        (receipt.tx_hash as string | null) ?? null,
      );
    }
  }

  const tasks = taskRows
    .map((row) => {
      const job = jobMap.get(row.task.job_id) ?? { title: "", reward_per_task: "0" };
      return {
        task_id: row.task_id,
        job_title: job.title,
        status: row.task.status,
        reward: job.reward_per_task,
        submitted_at: row.submitted_at,
        tx_hash: txBySubmission.get(row.id) ?? null,
      };
    })
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  const paid = tasks.filter((t) => t.status === "paid");
  const pending = tasks.filter((t) => t.status === "accepted");

  return {
    total_accepted: paid.length + pending.length,
    total_paid: sumDecimalStrings(paid.map((t) => t.reward)),
    total_pending: sumDecimalStrings(pending.map((t) => t.reward)),
    tasks,
  };
}