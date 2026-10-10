/**
 * GET /api/tasks/{id} – get task details plus a short-lived signed media URL.
 *
 * Roles: contributor (own leased tasks), reviewer, admin.
 * `gold_answer` is never returned.
 */

import type { NextRequest } from "next/server";
import { ok, withErrorHandler } from "@/lib/api/response";
import { withCors, corsOptions } from "@/lib/api/cors";
import { HttpError } from "@/lib/api/errors";
import { requireRole } from "@/lib/auth/requireRole";
import { getAssetObjectKey, loadTask, toTask } from "@/lib/tasks/repository";
import { createSignedMediaUrl } from "@/lib/storage";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCors(
    await withErrorHandler(async () => {
      const user = await requireRole(req, "contributor", "reviewer", "admin");
      const { id } = await params;

      const row = await loadTask(id);

      if (user.role === "contributor" && row.lease_owner !== user.id) {
        throw HttpError.forbidden("You do not hold a lease on this task");
      }

      const objectKey = await getAssetObjectKey(row.asset_id as string);
      const signedMediaUrl = await createSignedMediaUrl(objectKey);

      return ok(toTask(row, signedMediaUrl));
    }),
  );
}
