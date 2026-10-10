/**
 * POST /api/reviews/{submissionId}/decision – accept, revise, or reject a
 * submission (reviewer/admin; never the submission's own contributor).
 */

import type { NextRequest } from "next/server";
import { ok, withErrorHandler } from "@/lib/api/response";
import { withCors, corsOptions } from "@/lib/api/cors";
import { readJson } from "@/lib/api/request";
import { requireRole } from "@/lib/auth/requireRole";
import { reviewDecisionSchema } from "@/lib/validation/review";
import { decideSubmission } from "@/lib/review/service";
import type { ReviewDecisionInput } from "@/lib/validation/review";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  return withCors(
    await withErrorHandler(async () => {
      const reviewer = await requireRole(req, "reviewer", "admin");
      const { submissionId } = await params;

      const input: ReviewDecisionInput = reviewDecisionSchema.parse(
        await readJson(req),
      );

      const review = await decideSubmission({
        submissionId,
        reviewer,
        decision: input.decision,
        reasonCode: input.reason_code,
        confidence: input.confidence,
        notes: input.notes,
        rubricVersion: input.rubric_version,
      });

      return ok(review);
    }),
  );
}
