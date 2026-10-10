/**
 * Receipt row mapping + persistence.
 */

import { getSupabase } from "@/lib/db/supabase";
import { HttpError } from "@/lib/api/errors";
import type { Receipt, ReviewerType } from "@/src/types/api";

type Row = Record<string, unknown>;

export function toReceipt(row: Row): Receipt {
  return {
    id: row.id as string,
    submission_id: row.submission_id as string,
    annotation_hash: row.annotation_hash as string,
    policy_hash: row.policy_hash as string,
    review_ref: (row.review_ref as string | null) ?? null,
    tx_hash: (row.tx_hash as string | null) ?? null,
    is_mock: Boolean(row.is_mock),
    created_at: row.created_at as string,
  };
}

export interface InsertReceiptInput {
  submissionId: string;
  annotationHash: string;
  policyHash: string;
  reviewRef: string | null;
  txHash: string | null;
  isMock: boolean;
}

export async function insertReceipt(input: InsertReceiptInput): Promise<Receipt> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("receipts")
    .insert({
      submission_id: input.submissionId,
      annotation_hash: input.annotationHash,
      policy_hash: input.policyHash,
      review_ref: input.reviewRef,
      tx_hash: input.txHash,
      is_mock: input.isMock,
    })
    .select("*")
    .single();
  if (error) throw HttpError.internal(`Failed to record receipt: ${error.message}`);
  return toReceipt(data as Row);
}

/** Load a receipt row by id, or throw 404. */
export async function loadReceiptRow(receiptId: string): Promise<Row> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle();
  if (error) throw HttpError.internal(`Failed to load receipt: ${error.message}`);
  if (!data) throw HttpError.notFound("Receipt not found");
  return data as Row;
}

/** Latest accept review for a submission, if any. */
export async function loadAcceptingReview(
  submissionId: string,
): Promise<{ id: string; reviewer_type: ReviewerType } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, reviewer_type")
    .eq("submission_id", submissionId)
    .eq("decision", "accept")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw HttpError.internal(`Failed to load review: ${error.message}`);
  if (!data) return null;
  return data as unknown as { id: string; reviewer_type: ReviewerType };
}

/** Number of already-paid tasks in a job (for the budget guard). */
export async function countPaidTasksInJob(jobId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "paid");
  if (error) throw HttpError.internal(`Failed to count paid tasks: ${error.message}`);
  return count ?? 0;
}

/** Increment a contributor's completed-task counter (read-modify-write). */
export async function incrementTasksCompleted(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("contributor_profiles")
    .select("tasks_completed")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw HttpError.internal(`Failed to load profile: ${error.message}`);
  if (!data) return;
  const next = (data.tasks_completed as number | null ?? 0) + 1;
  const { error: updateError } = await supabase
    .from("contributor_profiles")
    .update({ tasks_completed: next })
    .eq("user_id", userId);
  if (updateError) {
    throw HttpError.internal(`Failed to update profile: ${updateError.message}`);
  }
}